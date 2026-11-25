import { NextResponse } from "next/server";

import { authMailKind, authMailLanguage, verifyStandardWebhook } from "@/lib/auth/sendEmailHookCore";
import { postLoginPath } from "@/lib/auth/postLoginPath";
import { configuredAppOrigin } from "@/lib/brand";
import { authEmail } from "@/lib/email/authTemplates";
import { buildFromAddress, sendEmail } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase "Send Email Hook" (Authentication → Auth Hooks → Send Email, HTTPS):
 * Supabase verstuurt geen auth-mails meer zelf maar roept deze route aan.
 * Wij sturen inlogcode, teamuitnodiging, nieuw wachtwoord en e-mailwijziging in
 * het Nederlands of Engels (lib/email/authTemplates.ts), via Resend.
 * Geheim: SEND_EMAIL_HOOK_SECRET (de "v1,whsec_…"-waarde uit Supabase).
 */

type HookPayload = {
  user?: { id?: string; email?: string; new_email?: string; user_metadata?: Record<string, unknown> };
  email_data?: { token?: string; token_hash?: string; redirect_to?: string; email_action_type?: string; token_new?: string; token_hash_new?: string };
};

const fail = (status: number, message: string) => NextResponse.json({ error: { http_code: status, message } }, { status });

function appOrigin(redirectTo: string | undefined) {
  const fallback = configuredAppOrigin();
  try {
    const url = new URL(redirectTo ?? "");
    const host = url.hostname;
    if (host === new URL(fallback).hostname || host.endsWith(".sequenceflow.io") || host === "localhost") return url.origin;
  } catch {
    // geen geldige terugkeerlink
  }
  return fallback;
}

export async function POST(request: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET?.trim();
  if (!secret) return fail(500, "SEND_EMAIL_HOOK_SECRET is not set");
  const body = await request.text();
  const valid = verifyStandardWebhook({
    secret,
    id: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
    body,
  });
  if (!valid) return fail(401, "Invalid signature");

  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    return fail(400, "Invalid JSON");
  }
  const user = payload.user ?? {};
  const data = payload.email_data ?? {};
  const action = data.email_action_type ?? "";
  const kind = authMailKind(action);
  if (!kind || !user.email) return fail(400, `Unsupported email type: ${action || "none"}`);

  // Werkruimte (naam en taal) voor uitnodigingen: tenant_id zit in de metadata van de uitnodiging.
  const tenantId = typeof user.user_metadata?.tenant_id === "string" ? user.user_metadata.tenant_id : null;
  let workspace: string | null = null;
  let workspaceLang: unknown = null;
  if (tenantId) {
    const db = getSupabaseAdmin();
    const [tenant, config] = await Promise.all([
      db.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
      db.from("tenant_agent_config").select("language_default").eq("tenant_id", tenantId).maybeSingle(),
    ]);
    workspace = (tenant.data?.name as string | undefined) ?? null;
    workspaceLang = config.data?.language_default;
  }
  const language = authMailLanguage({ redirectTo: data.redirect_to, userLang: user.user_metadata?.lang, workspaceLang });

  const origin = appOrigin(data.redirect_to);
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const verifyLink = (hash: string | undefined, type: string) =>
    hash ? `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(data.redirect_to || origin)}` : undefined;

  let next = "/dashboard";
  try { next = postLoginPath(new URL(data.redirect_to ?? "").searchParams.get("next")); } catch { /* standaard */ }

  // Inloggen gaat via onze eigen /auth/confirm (werkt in elke browser); de rest via Supabase zelf.
  const messages: Array<{ to: string; link?: string; code?: string }> = [];
  if (kind === "login") {
    const link = data.token_hash ? `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.token_hash)}&type=email&next=${encodeURIComponent(next)}` : undefined;
    messages.push({ to: user.email, link, code: data.token });
  } else if (kind === "email_change") {
    // Beveiligde wijziging: een bevestiging naar het nieuwe én het huidige adres.
    if (user.new_email) messages.push({ to: user.new_email, link: verifyLink(data.token_hash, "email_change") });
    if (data.token_hash_new) messages.push({ to: user.email, link: verifyLink(data.token_hash_new, "email_change") });
    if (!messages.length) messages.push({ to: user.email, link: verifyLink(data.token_hash, "email_change") });
  } else {
    messages.push({ to: user.email, link: kind === "reauthentication" ? undefined : verifyLink(data.token_hash, action), code: data.token });
  }

  try {
    for (const message of messages) {
      const mail = authEmail({ kind, language, code: message.code, link: message.link, workspace });
      await sendEmail({ to: message.to, from: buildFromAddress("Support One", null), subject: mail.subject, text: mail.text, html: mail.html });
    }
  } catch (error) {
    console.error("[auth/send-email]", action, error instanceof Error ? error.message : error);
    return fail(500, "Sending failed");
  }
  return NextResponse.json({});
}
