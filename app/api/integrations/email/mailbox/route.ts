import { NextResponse } from "next/server";

import { buildTenantInboundAddress } from "@/lib/email/inbound/address";
import { encryptSmtpPassword } from "@/lib/email/outbound/smtpCredentials";
import {
  isImapEncryption,
  isImapPresetKey,
  isSmtpEncryption,
  isSmtpPresetKey,
} from "@/lib/email/outbound/smtpPresets";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function validPort(value: unknown, label: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Enter a valid ${label} port.`);
  }
  return port;
}

export async function POST(req: Request) {
  let tenantId: string;
  try {
    const context = await getTenantId(req);
    if (context.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    tenantId = context.tenantId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  try {
    const body = await req.json();
    const email = cleanEmail(body.email);
    const fromName = cleanText(body.fromName) || null;
    const sharedPassword = cleanText(body.password);
    const imapPassword = cleanText(body.imap?.password) || sharedPassword;
    const smtpPassword = cleanText(body.smtp?.password) || sharedPassword;

    const imapProvider = isImapPresetKey(body.provider) ? body.provider : "other";
    const smtpProvider = isSmtpPresetKey(body.provider) ? body.provider : "other";
    const imapHost = cleanText(body.imap?.host).toLowerCase();
    const smtpHost = cleanText(body.smtp?.host).toLowerCase();
    const imapUsername = cleanText(body.imap?.username) || email;
    const smtpUsername = cleanText(body.smtp?.username) || email;
    const mailbox = cleanText(body.imap?.mailbox) || "INBOX";

    if (!email || !email.includes("@")) throw new Error("Enter a valid mailbox email address.");
    if (!imapHost || !smtpHost) throw new Error("Incoming and outgoing server details are required.");
    if (!imapUsername || !smtpUsername) throw new Error("Incoming and outgoing usernames are required.");

    const supabase = getSupabaseAdmin();
    const { data: existing, error: readError } = await supabase
      .from("tenant_email_channels")
      .select("id, inbound_address, imap_password_encrypted, smtp_password_encrypted")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle();

    if (readError) throw new Error(readError.message);

    const encryptedImapPassword = imapPassword
      ? encryptSmtpPassword(imapPassword)
      : existing?.imap_password_encrypted ?? null;
    const encryptedSmtpPassword = smtpPassword
      ? encryptSmtpPassword(smtpPassword)
      : existing?.smtp_password_encrypted ?? null;

    if (!encryptedImapPassword || !encryptedSmtpPassword) {
      throw new Error("Enter the mailbox password before saving.");
    }

    const now = new Date().toISOString();
    const payload = {
      tenant_id: tenantId,
      inbound_address: existing?.inbound_address ?? buildTenantInboundAddress(tenantId),
      outbound_from_email: email,
      outbound_from_name: fromName,
      is_default: true,
      imap_provider: imapProvider,
      imap_host: imapHost,
      imap_port: validPort(body.imap?.port, "IMAP"),
      imap_encryption: isImapEncryption(body.imap?.encryption) ? body.imap.encryption : "ssl",
      imap_username: imapUsername,
      imap_password_encrypted: encryptedImapPassword,
      imap_mailbox: mailbox,
      imap_status: "test_required",
      imap_last_error: null,
      smtp_provider: smtpProvider,
      smtp_host: smtpHost,
      smtp_port: validPort(body.smtp?.port, "SMTP"),
      smtp_encryption: isSmtpEncryption(body.smtp?.encryption) ? body.smtp.encryption : "starttls",
      smtp_username: smtpUsername,
      smtp_password_encrypted: encryptedSmtpPassword,
      smtp_from_email: email,
      smtp_from_name: fromName,
      smtp_status: "test_required",
      smtp_last_error: null,
      updated_at: now,
    };

    const query = existing?.id
      ? supabase.from("tenant_email_channels").update(payload).eq("id", existing.id).eq("tenant_id", tenantId)
      : supabase.from("tenant_email_channels").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, imapStatus: "test_required", smtpStatus: "test_required" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save mailbox settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
