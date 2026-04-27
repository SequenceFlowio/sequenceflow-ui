import { NextResponse } from "next/server";

import { encryptSmtpPassword } from "@/lib/email/outbound/smtpCredentials";
import { isSmtpEncryption, isSmtpPresetKey } from "@/lib/email/outbound/smtpPresets";
import { buildTenantInboundAddress } from "@/lib/email/inbound/address";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validatePort(value: unknown) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("Enter a valid SMTP port.");
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
    const provider = isSmtpPresetKey(body.provider) ? body.provider : "other";
    const host = cleanText(body.host).toLowerCase();
    const port = validatePort(body.port);
    const encryption = isSmtpEncryption(body.encryption) ? body.encryption : "starttls";
    const username = cleanText(body.username);
    const fromEmail = cleanEmail(body.fromEmail);
    const fromName = cleanText(body.fromName) || null;
    const password = typeof body.password === "string" ? body.password : "";

    if (!host) return NextResponse.json({ error: "SMTP host is required." }, { status: 400 });
    if (!username) return NextResponse.json({ error: "SMTP username is required." }, { status: 400 });
    if (!fromEmail || !fromEmail.includes("@")) {
      return NextResponse.json({ error: "Enter a valid from email address." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("tenant_email_channels")
      .select("id, inbound_address, outbound_from_email, smtp_password_encrypted")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle();

    let encryptedPassword = existing?.smtp_password_encrypted ?? null;
    if (password.trim()) {
      encryptedPassword = encryptSmtpPassword(password.trim());
    }

    if (!encryptedPassword) {
      return NextResponse.json({ error: "SMTP password is required before testing." }, { status: 400 });
    }

    const payload = {
      tenant_id: tenantId,
      inbound_address: existing?.inbound_address ?? buildTenantInboundAddress(tenantId),
      outbound_from_email: existing?.outbound_from_email ?? fromEmail,
      outbound_from_name: fromName,
      is_default: true,
      smtp_provider: provider,
      smtp_host: host,
      smtp_port: port,
      smtp_encryption: encryption,
      smtp_username: username,
      smtp_password_encrypted: encryptedPassword,
      smtp_from_email: fromEmail,
      smtp_from_name: fromName,
      smtp_status: "test_required",
      smtp_last_error: null,
      updated_at: new Date().toISOString(),
    };

    const query = existing?.id
      ? supabase.from("tenant_email_channels").update(payload).eq("id", existing.id)
      : supabase.from("tenant_email_channels").insert(payload);

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "test_required" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save SMTP settings.";
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
      smtp_provider: "other",
      smtp_host: null,
      smtp_port: null,
      smtp_encryption: "starttls",
      smtp_username: null,
      smtp_password_encrypted: null,
      smtp_from_email: null,
      smtp_from_name: null,
      smtp_status: "not_configured",
      smtp_last_error: null,
      smtp_last_tested_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("is_default", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
