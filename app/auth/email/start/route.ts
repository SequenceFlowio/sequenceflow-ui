import { NextRequest, NextResponse } from "next/server";

import { emailLoginError, normalizeEmail } from "@/lib/auth/emailLoginCore";
import { postLoginPath } from "@/lib/auth/postLoginPath";
import { serverAuthClient } from "@/lib/auth/serverAuthClient";
import { requestAppOrigin } from "@/lib/brand";
import { RATE_LIMITS, allowRequest, clientIp } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Stap 1 van inloggen met e-mail: Supabase mailt een inloglink en een code.
 * Begint op de server (net als Google in /auth/start), zodat de PKCE-cookie
 * van de link op dezelfde host staat als /auth/callback.
 *
 * Botcheck: het Turnstile-token gaat naar Supabase (Auth → Attack
 * Protection → Captcha). Alleen daar beschermt het echt, want de Supabase-API
 * is ook rechtstreeks aan te roepen met de publieke sleutel.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const lang = body?.lang === "en" ? "en" : "nl";
  const email = normalizeEmail(body?.email);
  if (!email) return NextResponse.json({ error: lang === "en" ? "Enter a valid email address." : "Vul een geldig e-mailadres in." }, { status: 400 });

  const [ipAllowed, emailAllowed] = await Promise.all([
    allowRequest("email-login-ip", clientIp(request), RATE_LIMITS.emailLoginIp),
    allowRequest("email-login-email", email, RATE_LIMITS.emailLoginEmail),
  ]);
  if (!ipAllowed || !emailAllowed) return NextResponse.json({ error: emailLoginError("rate", lang) }, { status: 429 });

  const next = postLoginPath(typeof body?.next === "string" ? body.next : null);
  const callback = new URL("/auth/callback", requestAppOrigin(request.url));
  callback.searchParams.set("next", next);
  callback.searchParams.set("via", "email");

  const { supabase } = await serverAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: true,
      captchaToken: typeof body?.captchaToken === "string" ? body.captchaToken : undefined,
    },
  });
  if (error) {
    console.error("[auth/email/start]", error.status, error.message);
    return NextResponse.json({ error: emailLoginError(error.message, lang) }, { status: error.status === 429 ? 429 : 400 });
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
