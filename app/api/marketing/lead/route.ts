import { NextRequest, NextResponse } from "next/server";

import { getResendClient } from "@/lib/email/outbound/resendClient";
import { parseLead } from "@/lib/marketing/freebies/catalog";
import { RATE_LIMITS, allowRequest, clientIp } from "@/lib/security/rateLimit";
import { TURNSTILE_MESSAGE, verifyTurnstile } from "@/lib/security/turnstile";

export const runtime = "nodejs";

/**
 * E-mailgate van de gratis downloads (/nl/gratis, /en/free).
 *
 * Bewaart de aanmelding op twee plekken, zonder eigen tabel:
 * 1. als contact in Resend (Audience/segment uit RESEND_LEADS_SEGMENT_ID),
 *    met unsubscribed = true als iemand géén tips wil: dan krijgt hij nooit
 *    een nieuwsbrief, alleen de download;
 * 2. een korte melding naar hallo@sequenceflow.io (onderwerp begint met
 *    "[Download]", zodat je er een filter op kunt zetten).
 *
 * Er gaat bewust geen mail naar het ingevulde adres: een openbaar formulier
 * dat naar willekeurige adressen mailt, is misbruikbaar. De download opent
 * direct op de pagina. Mislukt het bewaren, dan krijgt de bezoeker de
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

  const resend = (() => {
    try {
      return getResendClient();
    } catch (error) {
      console.error("[marketing/lead] geen Resend", error);
      return null;
    }
  })();

  if (resend) {
    const segment = process.env.RESEND_LEADS_SEGMENT_ID?.trim();
    const [contact, notice] = await Promise.allSettled([
      resend.contacts.create({
        email: lead.email,
        firstName: lead.name || undefined,
        unsubscribed: !lead.marketing,
        ...(segment ? { segments: [{ id: segment }] } : {}),
      }),
      resend.emails.send({
        from: "SequenceFlow <noreply@mail.sequenceflow.io>",
        to: "hallo@sequenceflow.io",
        subject: `[Download] ${lead.freebie.keyword}: ${lead.email}`,
        text: [
          `Nieuwe download: ${lead.freebie.nl.title} (${lead.lang.toUpperCase()})`,
          "",
          `E-mail: ${lead.email}`,
          `Naam: ${lead.name || "—"}`,
          `Webshop: ${lead.store || "—"}`,
          `Wil tips ontvangen: ${lead.marketing ? "ja" : "nee"}`,
          `Bron: ${lead.source || "—"}`,
        ].join("\n"),
      }),
    ]);
    for (const [label, result] of [["contact", contact], ["melding", notice]] as const) {
      if (result.status === "rejected") console.error(`[marketing/lead] ${label}`, result.reason);
      else if (result.value.error) console.error(`[marketing/lead] ${label}`, result.value.error);
    }
  }

  return NextResponse.json({ ok: true });
}
