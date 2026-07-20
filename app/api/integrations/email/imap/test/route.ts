import { NextResponse } from "next/server";

import { verifyImapChannel, type ImapChannelConfig } from "@/lib/email/inbound/imap";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChannelRow = {
  id: string;
  tenant_id: string;
  outbound_from_email: string | null;
  smtp_from_email: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_encryption: "starttls" | "ssl" | "none" | null;
  imap_username: string | null;
  imap_password_encrypted: string | null;
  imap_mailbox: string | null;
  imap_uid_validity: string | null;
  imap_last_uid: number | null;
};

function toImapChannel(row: ChannelRow): ImapChannelConfig {
  if (!row.imap_host || !row.imap_port || !row.imap_username || !row.imap_password_encrypted) {
    throw new Error("IMAP settings are incomplete. Save the IMAP form first.");
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    host: row.imap_host,
    port: Number(row.imap_port),
    encryption: row.imap_encryption ?? "ssl",
    username: row.imap_username,
    passwordEncrypted: row.imap_password_encrypted,
    mailbox: row.imap_mailbox || "INBOX",
    recipientEmail: row.smtp_from_email ?? row.outbound_from_email ?? row.imap_username,
    uidValidity: row.imap_uid_validity,
    lastUid: row.imap_last_uid ?? 0,
  };
}

function humanizeImapError(error: unknown, host?: string) {
  // ImapFlow attaches richer fields than `error.message`. We pull them out so a
  // bare "Command failed" doesn't reach the user.
  const err = error as Partial<{
    message: string;
    code: string;
    response: string;
    responseText: string;
    responseStatus: "NO" | "BAD" | "BYE" | string;
    serverResponseCode: string;
    authenticationFailed: boolean;
    command: string;
  }> | undefined;

  const raw = err?.message ?? String(error);
  const responseText = err?.responseText ?? err?.response ?? "";
  const lower = `${raw} ${responseText}`.toLowerCase();
  const isHostinger = (host ?? "").toLowerCase().includes("hostinger");

  // ImapFlow throws "Command failed" when LOGIN is rejected with no parsed text.
  // Treat it as auth unless we have evidence otherwise.
  const looksLikeAuthFail =
    err?.authenticationFailed === true ||
    err?.command === "LOGIN" ||
    err?.responseStatus === "NO" ||
    lower.includes("auth") ||
    lower.includes("login") ||
    lower.includes("password") ||
    lower.includes("credentials") ||
    raw.trim().toLowerCase() === "command failed";

  if (looksLikeAuthFail) {
    if (isHostinger) {
      return [
        "Hostinger rejected the login. Three things to check:",
        "1) Use the mailbox password set in hPanel → Emails → Manage → that specific mailbox. It's NOT your Hostinger account/hPanel login.",
        "2) Wait 15–30 minutes if you've tried wrong passwords several times — Hostinger temporarily blocks logins after repeated failures.",
        "3) In hPanel, confirm IMAP access is enabled for the mailbox.",
      ].join(" ");
    }
    return "IMAP authentication failed. Verify the mailbox password (use an app password if 2FA is on) and that IMAP access is enabled for this mailbox.";
  }

  if (lower.includes("econnrefused") || lower.includes("etimedout") || lower.includes("enotfound")) {
    return "Could not connect to the IMAP server. Check host, port, and security settings.";
  }
  if (lower.includes("certificate") || lower.includes("tls") || lower.includes("ssl")) {
    return "IMAP TLS/SSL handshake failed. Check whether this provider expects SSL 993 or STARTTLS 143.";
  }

  // Surface anything the server actually said, not just the generic message.
  if (responseText && responseText !== raw) {
    return `IMAP error: ${raw} — server said: ${responseText.slice(0, 200)}`;
  }
  return raw;
}

export async function POST(req: Request) {
  let tenantId: string;
  try {
    const context = await getTenantId(req);
    if (context.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    tenantId = context.tenantId;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: channel, error } = await supabase
    .from("tenant_email_channels")
    .select("id, tenant_id, outbound_from_email, smtp_from_email, imap_host, imap_port, imap_encryption, imap_username, imap_password_encrypted, imap_mailbox, imap_uid_validity, imap_last_uid")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle<ChannelRow>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!channel) return NextResponse.json({ error: "IMAP settings not found." }, { status: 404 });

  try {
    const imapChannel = toImapChannel(channel);
    const verified = await verifyImapChannel(imapChannel);
    await supabase
      .from("tenant_email_channels")
      .update({
        imap_status: "active",
        imap_uid_validity: verified.uidValidity,
        // Activation starts from "now" so old mailbox history is not imported as new support.
        imap_last_uid: verified.latestUid,
        imap_last_tested_at: new Date().toISOString(),
        imap_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    return NextResponse.json({
      ok: true,
      status: "active",
      mailboxMessages: verified.exists,
      startsAfterUid: verified.latestUid,
    });
  } catch (err: unknown) {
    // Log the raw error server-side — humanizeImapError swallows technical
    // detail for the user, but we still want the full picture in Vercel logs
    // for debugging IMAP rejections (e.g. "Command failed" from LOGIN).
    const errAny = err as Record<string, unknown> | undefined;
    console.error("[imap/test] verifyImapChannel failed", {
      tenantId,
      host: channel.imap_host,
      port: channel.imap_port,
      encryption: channel.imap_encryption,
      message: errAny?.message,
      code: errAny?.code,
      command: errAny?.command,
      responseStatus: errAny?.responseStatus,
      response: errAny?.response,
      responseText: errAny?.responseText,
      authenticationFailed: errAny?.authenticationFailed,
    });

    const message = humanizeImapError(err, channel.imap_host ?? undefined);
    await supabase
      .from("tenant_email_channels")
      .update({
        imap_status: "failed",
        imap_last_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    return NextResponse.json({ error: message, status: "failed" }, { status: 400 });
  }
}
