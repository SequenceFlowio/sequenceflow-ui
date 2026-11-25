import { NextRequest, NextResponse } from "next/server";

import { checkLeadCode, completeLead } from "@/lib/marketing/leads";
import { RATE_LIMITS, allowRequest, clientIp } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

const MESSAGES = {
  nl: { wrong: "Die code klopt niet. Kijk nog even in je mail.", expired: "Deze code is verlopen. Vraag een nieuwe aan.", invalid: "Er ging iets mis. Vraag een nieuwe code aan.", limit: "Te veel pogingen. Probeer het over een kwartier opnieuw." },
  en: { wrong: "That code isn't right. Check your email again.", expired: "This code has expired. Request a new one.", invalid: "Something went wrong. Request a new code.", limit: "Too many attempts. Try again in 15 minutes." },
};

/**
 * Academy-gate, stap 2 van 2: de code uit de mail plus het wachttoken uit stap 1.
 * Klopt de code, dan pas wordt de aanmelding bewaard en gaat de mail met de link
 * eruit. Limiet per IP tegen raden (6 cijfers, 15 minuten geldig).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { pending?: unknown; code?: unknown; lang?: unknown } | null;
  const lang = body?.lang === "en" ? "en" : "nl";
  const t = MESSAGES[lang];
  if (!body || JSON.stringify(body).length > 4_000) return NextResponse.json({ error: t.invalid }, { status: 400 });
  if (!(await allowRequest("lead-code", clientIp(req), RATE_LIMITS.emailCodeIp))) return NextResponse.json({ error: t.limit }, { status: 429 });

  const result = checkLeadCode(body.pending, body.code);
  if ("error" in result) return NextResponse.json({ error: t[result.error] }, { status: 400 });

  await completeLead(result.lead);
  return NextResponse.json({ ok: true });
}
