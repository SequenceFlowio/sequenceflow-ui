import { NextResponse } from "next/server";

import { adminState, backofficeAuthClient } from "@/lib/backoffice/auth";
import { cleanCode, isAdminEmail } from "@/lib/backoffice/authCore";
import { backofficeCodeEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/resend";
import { allowRequest, clientIp, tooManyRequests } from "@/lib/security/rateLimit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Inloggen op het beheerdashboard, in twee stappen:
 * 1. een eenmalige code naar het e-mailadres (alleen adressen in PLATFORM_ADMIN_EMAILS);
 * 2. de code uit de authenticator-app. De eerste keer koppel je die app hier.
 *
 * De sessie en de authenticator worden door Supabase Auth bewaard; er is geen
 * eigen tabel of wachtwoord. Antwoorden verraden niet of een adres bestaat.
 */

const LIMITS = {
  requestIp: { limit: 8, windowSeconds: 15 * 60 },
  requestEmail: { limit: 5, windowSeconds: 15 * 60 },
  verifyIp: { limit: 20, windowSeconds: 15 * 60 },
} as const;

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);

type AuthClient = NonNullable<Awaited<ReturnType<typeof backofficeAuthClient>>>;

/** Welke stap volgt na de e-mailcode: bestaande authenticator bevestigen, of een nieuwe koppelen. */
async function nextMfaStep(supabase: AuthClient) {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  const verified = (data.totp ?? []).find((factor) => factor.status === "verified");
  if (verified) return { step: "totp" as const };

  // Een eerdere, niet afgemaakte koppeling staat een nieuwe in de weg.
  for (const factor of data.all ?? []) {
    if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `SequenceFlow beheer ${Date.now()}`, issuer: "SequenceFlow beheer" });
  if (enrolled.error) throw new Error(enrolled.error.message);
  return { step: "enroll" as const, factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret };
}

export async function POST(request: Request) {
  // Alleen van onze eigen pagina.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return fail("Ongeldige aanvraag.", 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return fail("Ongeldige aanvraag.");
  }
  const action = body.action;
  const ip = clientIp(request);
  const supabase = await backofficeAuthClient();
  if (!supabase) return fail("Inloggen is niet geconfigureerd.", 503);

  try {
    if (action === "request_code") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
      if (!email.includes("@")) return fail("Vul je e-mailadres in.");
      if (!(await allowRequest("backoffice-code-ip", ip, LIMITS.requestIp)) || !(await allowRequest("backoffice-code-email", email, LIMITS.requestEmail))) {
        return tooManyRequests("Te veel pogingen. Probeer het over een kwartier opnieuw.");
      }
      if (isAdminEmail(email, process.env.PLATFORM_ADMIN_EMAILS)) {
        const admin = getSupabaseAdmin().auth.admin;
        let { data, error } = await admin.generateLink({ type: "magiclink", email });
        if (error || !data.properties?.email_otp) {
          // Een beheerder zonder Support One-account (bijvoorbeeld een tweede beheerder): maak het
          // inlogaccount aan. Alleen voor adressen op de beheerderslijst; het geeft geen werkruimte.
          const created = await admin.createUser({ email, email_confirm: true });
          if (!created.error) ({ data, error } = await admin.generateLink({ type: "magiclink", email }));
        }
        if (error || !data.properties?.email_otp) {
          console.error("[backoffice/auth] code aanmaken mislukt:", error?.message ?? "geen code");
          return fail("Code versturen is mislukt. Probeer het opnieuw.", 502);
        }
        const mail = backofficeCodeEmail({ code: data.properties.email_otp });
        await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
      }
      // Hetzelfde antwoord voor elk adres.
      return json({ ok: true, step: "code" });
    }

    if (action === "verify_code") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const code = cleanCode(body.code);
      if (!(await allowRequest("backoffice-verify-ip", ip, LIMITS.verifyIp))) return tooManyRequests("Te veel pogingen. Probeer het over een kwartier opnieuw.");
      if (!isAdminEmail(email, process.env.PLATFORM_ADMIN_EMAILS) || code.length < 6) return fail("Deze code klopt niet of is verlopen.", 401);
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) return fail("Deze code klopt niet of is verlopen.", 401);
      return json({ ok: true, ...(await nextMfaStep(supabase)) });
    }

    if (action === "mfa_step") {
      const state = await adminState();
      if (state.state !== "needs_mfa") return fail("Log eerst in met je e-mailcode.", 401);
      return json({ ok: true, ...(await nextMfaStep(supabase)) });
    }

    if (action === "verify_totp") {
      const state = await adminState();
      if (state.state !== "needs_mfa" && state.state !== "ok") return fail("Log eerst in met je e-mailcode.", 401);
      if (!(await allowRequest("backoffice-verify-ip", ip, LIMITS.verifyIp))) return tooManyRequests("Te veel pogingen. Probeer het over een kwartier opnieuw.");
      const code = cleanCode(body.code);
      if (code.length !== 6) return fail("Vul de zes cijfers uit je authenticator-app in.");
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw new Error(listError.message);
      const verified = (factors.totp ?? []).find((factor) => factor.status === "verified");
      // Koppelen kan alleen zolang er nog geen bevestigde authenticator is.
      const pending = typeof body.factorId === "string" ? (factors.all ?? []).find((factor) => factor.id === body.factorId && factor.status !== "verified") : undefined;
      const factorId = verified?.id ?? pending?.id;
      if (!factorId) return fail("Geen authenticator gevonden. Begin opnieuw.", 409);
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) return fail("Deze code klopt niet. Wacht op de volgende code en probeer het opnieuw.", 401);
      return json({ ok: true, step: "done" });
    }

    if (action === "logout") {
      await supabase.auth.signOut({ scope: "local" });
      return json({ ok: true });
    }
  } catch (error) {
    console.error("[backoffice/auth]", error instanceof Error ? error.message : error);
    return fail("Er ging iets mis. Probeer het opnieuw.", 500);
  }

  return fail("Onbekende actie.");
}
