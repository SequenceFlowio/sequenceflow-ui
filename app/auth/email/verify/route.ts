import { NextRequest, NextResponse } from "next/server";

import { emailLoginError, normalizeCode, normalizeEmail } from "@/lib/auth/emailLoginCore";
import { finishSignIn } from "@/lib/auth/finishSignIn";
import { postLoginPath } from "@/lib/auth/postLoginPath";
import { serverAuthClient } from "@/lib/auth/serverAuthClient";
import { RATE_LIMITS, allowRequest, clientIp } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Stap 2 van inloggen met e-mail: de code uit de mail. Werkt ook als de
 * mail op een ander apparaat wordt geopend dan waar je inlogt.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const lang = body?.lang === "en" ? "en" : "nl";
  const email = normalizeEmail(body?.email);
  const code = normalizeCode(body?.code);
  if (!email || !code) return NextResponse.json({ error: emailLoginError("invalid", lang) }, { status: 400 });

  // Tegen raden: weinig pogingen per IP en per adres.
  const [ipAllowed, emailAllowed] = await Promise.all([
    allowRequest("email-code-ip", clientIp(request), RATE_LIMITS.emailCodeIp),
    allowRequest("email-code-email", email, RATE_LIMITS.emailCodeEmail),
  ]);
  if (!ipAllowed || !emailAllowed) return NextResponse.json({ error: emailLoginError("rate", lang) }, { status: 429 });

  const { supabase, cookieStore } = await serverAuthClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    console.warn("[auth/email/verify]", error.status, error.message);
    return NextResponse.json({ error: emailLoginError(error.message, lang) }, { status: 400 });
  }
  await finishSignIn(supabase, cookieStore, "E-mail");
  const next = postLoginPath(typeof body?.next === "string" ? body.next : null);
  const response = NextResponse.json({ ok: true, next });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
