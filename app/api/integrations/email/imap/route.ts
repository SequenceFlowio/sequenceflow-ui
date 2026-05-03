import { NextResponse } from "next/server";

import { encryptSmtpPassword } from "@/lib/email/outbound/smtpCredentials";
import { isImapEncryption, isImapPresetKey } from "@/lib/email/outbound/smtpPresets";
import { buildTenantInboundAddress } from "@/lib/email/inbound/address";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validatePort(value: unknown) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Enter a valid IMAP port.");
  }
  return port;
}

export async function POST(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  try {
    const body = await req.json();
    const provider = isImapPresetKey(body.provider) ? body.provider : "other";
    const host = cleanText(body.host).toLowerCase();
    const port = validatePort(body.port);
    const encryption = isImapEncryption(body.encryption) ? body.encryption : "ssl";
    const username = cleanText(body.username);
    const mailbox = cleanText(body.mailbox) || "INBOX";
    const password = typeof body.password === "string" ? body.password : "";

    if (!host) return NextResponse.json({ error: "IMAP host is required." }, { status: 400 });
    if (!username) return NextResponse.json({ error: "IMAP username is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("tenant_email_channels")
      .select("id, inbound_address, outbound_from_email, imap_password_encrypted")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle();

    let encryptedPassword = existing?.imap_password_encrypted ?? null;
    if (password.trim()) {
      encryptedPassword = encryptSmtpPassword(password.trim());
    }

    if (!encryptedPassword) {
      return NextResponse.json({ error: "IMAP password is required before testing." }, { status: 400 });
    }

    const payload = {
      tenant_id: tenantId,
      inbound_address: existing?.inbound_address ?? buildTenantInboundAddress(tenantId),
      outbound_from_email: existing?.outbound_from_email ?? username.toLowerCase(),
      is_default: true,
      imap_provider: provider,
      imap_host: host,
      imap_port: port,
      imap_encryption: encryption,
      imap_username: username,
      imap_password_encrypted: encryptedPassword,
      imap_mailbox: mailbox,
      imap_status: "test_required",
      imap_last_error: null,
      updated_at: new Date().toISOString(),
    };

    const query = existing?.id
      ? supabase.from("tenant_email_channels").update(payload).eq("id", existing.id)
      : supabase.from("tenant_email_channels").insert(payload);

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: "test_required" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save IMAP settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const { error } = await getSupabaseAdmin()
    .from("tenant_email_channels")
    .update({
      imap_provider: "other",
      imap_host: null,
      imap_port: null,
      imap_encryption: "ssl",
      imap_username: null,
      imap_password_encrypted: null,
      imap_mailbox: "INBOX",
      imap_status: "not_configured",
      imap_last_error: null,
      imap_last_tested_at: null,
      imap_uid_validity: null,
      imap_last_uid: 0,
      imap_last_synced_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("is_default", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
