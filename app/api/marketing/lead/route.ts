import { NextRequest, NextResponse } from "next/server";

import { parseLead } from "@/lib/marketing/freebies/catalog";
import { sendLeadCode } from "@/lib/marketing/leads";
import { RATE_LIMITS, allowRequest, clientIp } from "@/lib/security/rateLimit";
import { TURNSTILE_MESSAGE, verifyTurnstile } from "@/lib/security/turnstile";

export const runtime = "nodejs";

/**
 * E-mailgate van de Academy (/nl/academy, /en/academy), stap 1 van 2: controleert
 * honeypot, limieten en Turnstile en mailt een code van 6 cijfers. Het antwoord
 * bevat een ondertekend wachttoken; ./verify bewaart de aanmelding pas als de
 * code klopt (zo staan er alleen echte e-mailadressen op de lijst).
 *
 * Na de code (./verify):
 *
 * Bewaart de aanmelding op twee plekken, zonder eigen tabel:
 * 1. als contact in Resend (Audience/segment uit RESEND_LEADS_SEGMENT_ID),
 *    met unsubscribed = true als iemand géén tips wil: dan krijgt hij nooit
 *    een nieuwsbrief, alleen de download;
 * 2. een korte melding naar hallo@sequenceflow.io (onderwerp begint met
 *    "[Download]", zodat je er een filter op kunt zetten).
 *
 * 3. in marketing_leads (migratie 079): taal, toestemming en de mailreeks.
 *
 * De aanvrager krijgt één mail met de downloadlink, in de taal van de pagina.
 * Dat mag nu de botcheck (Turnstile) en de limiet per IP ervoor staan. De
 * download opent daarnaast direct op de pagina. Mislukt het bewaren, dan krijgt de bezoeker de
 * download toch; de fout staat in de logs.
 *
 * Tegen bots: honeypot, minimale invultijd, limiet per IP en Cloudflare
 * Turnstile (als TURNSTILE_SECRET_KEY gezet is).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || JSON.stringify(body).length > 4_000) return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });

  // Honeypot of te snel ingevuld: stil 'gelukt' teruggeven, niets bewaren.
  if (String(body.company ?? "").trim() || Number(body.elapsedMs) < 2500) return NextResponse.json({ ok: true });

  const parsed = parseLead(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { lead } = parsed;

  if (!(await allowRequest("lead-magnet", clientIp(req), RATE_LIMITS.leadMagnet))) {
    const message = lead.lang === "en" ? "Too many requests. Try again in an hour." : "Te veel aanvragen. Probeer het over een uur opnieuw.";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const captcha = await verifyTurnstile(body.captchaToken, clientIp(req));
  if (!captcha.ok) {
    console.warn("[marketing/lead] botcheck", captcha.reason);
    return NextResponse.json({ error: TURNSTILE_MESSAGE[lead.lang] }, { status: 400 });
  }

  // Nog niets bewaren: eerst bewijzen dat het e-mailadres klopt (code per mail, stap 2 in ./verify).
  if (!(await allowRequest("lead-email", lead.email, RATE_LIMITS.emailLoginEmail))) {
    const message = lead.lang === "en" ? "Too many codes for this address. Try again in an hour." : "Te veel codes voor dit adres. Probeer het over een uur opnieuw.";
    return NextResponse.json({ error: message }, { status: 429 });
  }
  try {
    const pending = await sendLeadCode(lead);
    return NextResponse.json({ ok: true, pending });
  } catch (error) {
    console.error("[marketing/lead] code versturen mislukt", error instanceof Error ? error.message : error);
    const message = lead.lang === "en" ? "We couldn't send the code. Try again in a moment." : "Het versturen van de code lukte niet. Probeer het zo nog eens.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
