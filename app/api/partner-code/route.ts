import { NextResponse } from "next/server";

import { AFFILIATE, REF_COOKIE, REFERRAL } from "@/lib/referrals/program";
import { refCookieOptions, resolveRefCode } from "@/lib/referrals/server";
import { allowRequest, clientIp } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

/**
 * Partnercode op het aanmeldscherm, vóór het inloggen met Google. Doet hetzelfde als
 * een klik op sequenceflow.io/r/<code>: onthoudt de code, zodat de nieuwe werkruimte
 * bij het aanmaken aan de partner wordt gekoppeld.
 */
export async function POST(req: Request) {
  if (!(await allowRequest("partner-code-ip", clientIp(req), { limit: 20, windowSeconds: 60 * 60 }))) {
    return NextResponse.json({ error: "Te veel pogingen. Probeer het later opnieuw." }, { status: 429 });
  }
  let code = "";
  try {
    const body = await req.json() as { code?: unknown };
    code = typeof body.code === "string" ? body.code.trim().toLowerCase().replace(/^@/, "").slice(0, 40) : "";
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }
  const ref = code ? await resolveRefCode(code).catch(() => null) : null;
  if (!ref) return NextResponse.json({ error: "Deze code kennen we niet. Controleer de spelling." }, { status: 404 });
  const rate = ref.type === "affiliate" ? AFFILIATE.newCustomerRate : REFERRAL.newCustomerRate;
  const response = NextResponse.json({ ok: true, code, discountPct: Math.round(rate * 100) });
  response.cookies.set(REF_COOKIE, code, refCookieOptions(req.headers.get("host")));
  return response;
}
