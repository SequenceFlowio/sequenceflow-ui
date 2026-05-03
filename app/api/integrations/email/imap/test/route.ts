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

function humanizeImapError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes("auth") || lower.includes("login") || lower.includes("password") || lower.includes("credentials")) {
    return "IMAP authentication failed. Check the username/password or enable IMAP/app passwords for this mailbox.";
  }
  if (lower.includes("econnrefused") || lower.includes("etimedout") || lower.includes("enotfound")) {
    return "Could not connect to the IMAP server. Check host, port, and security settings.";
  }
  if (lower.includes("certificate") || lower.includes("tls") || lower.includes("ssl")) {
    return "IMAP TLS/SSL failed. Check whether this provider expects SSL 993 or STARTTLS 143.";
  }
  return raw;
}

export async function POST(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
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
    const message = humanizeImapError(err);
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
