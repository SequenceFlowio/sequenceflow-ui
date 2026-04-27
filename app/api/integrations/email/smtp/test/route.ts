import { NextResponse } from "next/server";

import { verifySmtpChannel, sendSmtpEmail } from "@/lib/email/outbound/smtp";
import type { SmtpChannelConfig } from "@/lib/email/outbound/smtp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChannelRow = {
  id: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_encryption: "starttls" | "ssl" | "none" | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  smtp_from_email: string | null;
  smtp_from_name: string | null;
};

function toSmtpChannel(row: ChannelRow): SmtpChannelConfig {
  if (!row.smtp_host || !row.smtp_port || !row.smtp_username || !row.smtp_password_encrypted || !row.smtp_from_email) {
    throw new Error("SMTP settings are incomplete. Save the SMTP form first.");
  }

  return {
    host: row.smtp_host,
    port: Number(row.smtp_port),
    encryption: row.smtp_encryption ?? "starttls",
    username: row.smtp_username,
    passwordEncrypted: row.smtp_password_encrypted,
    fromEmail: row.smtp_from_email,
    fromName: row.smtp_from_name,
  };
}

function humanizeSmtpError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes("auth") || lower.includes("login") || lower.includes("535") || lower.includes("username")) {
    return "SMTP authentication failed. Check the username/password or enable SMTP AUTH/app passwords for this mailbox.";
  }
  if (lower.includes("econnrefused") || lower.includes("etimedout") || lower.includes("enotfound")) {
    return "Could not connect to the SMTP server. Check host, port, and encryption settings.";
  }
  if (lower.includes("certificate") || lower.includes("tls") || lower.includes("ssl")) {
    return "SMTP TLS/SSL failed. Check whether this provider expects SSL 465 or STARTTLS 587.";
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
    .select("id, smtp_host, smtp_port, smtp_encryption, smtp_username, smtp_password_encrypted, smtp_from_email, smtp_from_name")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle<ChannelRow>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!channel) return NextResponse.json({ error: "SMTP settings not found." }, { status: 404 });

  try {
    const smtpChannel = toSmtpChannel(channel);
    await verifySmtpChannel(smtpChannel);
    await sendSmtpEmail({
      channel: smtpChannel,
      to: smtpChannel.fromEmail,
      subject: "ReplyOS SMTP test",
      text: [
        "Your ReplyOS SMTP connection works.",
        "",
        "Replies can now be sent from this mailbox instead of a ReplyOS sender address.",
      ].join("\n"),
    });

    await supabase
      .from("tenant_email_channels")
      .update({
        smtp_status: "active",
        smtp_last_tested_at: new Date().toISOString(),
        smtp_last_error: null,
        outbound_from_email: smtpChannel.fromEmail,
        outbound_from_name: smtpChannel.fromName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    return NextResponse.json({ ok: true, status: "active" });
  } catch (err: unknown) {
    const message = humanizeSmtpError(err);
    await supabase
      .from("tenant_email_channels")
      .update({
        smtp_status: "failed",
        smtp_last_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    return NextResponse.json({ error: message, status: "failed" }, { status: 400 });
  }
}
