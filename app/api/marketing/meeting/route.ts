import { NextRequest, NextResponse } from "next/server";

import { getResendClient } from "@/lib/email/outbound/resendClient";

export const runtime = "nodejs";

/**
 * Kennismakingsaanvraag van de landing → mail naar hallo@sequenceflow.io.
 * Openbaar formulier, dus: strenge validatie, een honeypot, een minimale
 * invultijd en een eenvoudige limiet per IP (best effort per instance).
 * Er gaat bewust geen automatische mail naar de aanvrager: een openbaar
 * formulier dat naar willekeurige adressen mailt, is misbruikbaar.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

const TOPICS: Record<string, string> = { kennismaking: "Kennismaking", inrichting: "Inrichting (€490)", maatwerk: "Maatwerk" };

const clean = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });

  // Honeypot of te snel ingevuld: stil 'gelukt' teruggeven, niets versturen.
  if (clean(body.company, 200) || Number(body.elapsedMs) < 3000) {
    return NextResponse.json({ ok: true });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "Te veel aanvragen. Mail ons gerust direct: hallo@sequenceflow.io." }, { status: 429 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const store = clean(body.store, 200);
  const volume = clean(body.volume, 40);
  const day = clean(body.day, 40);
  const slot = clean(body.slot, 10);
  const topic = TOPICS[clean(body.topic, 40)] ?? TOPICS.kennismaking;
  const message = String(body.message ?? "").trim().slice(0, 1500);

  if (!name) return NextResponse.json({ error: "Vul je naam in." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  if (!day || !/^\d{2}:\d{2}$/.test(slot)) return NextResponse.json({ error: "Kies een dag en een tijd." }, { status: 400 });

  try {
    await getResendClient().emails.send({
      from: "SequenceFlow <noreply@mail.sequenceflow.io>",
      to: "hallo@sequenceflow.io",
      replyTo: email,
      subject: `${topic}: ${name} · ${day} om ${slot}`,
      text: [
        `Nieuwe aanvraag via de website.`,
        ``,
        `Onderwerp: ${topic}`,
        `Voorkeur: ${day} om ${slot} (Nederlandse tijd)`,
        `Naam: ${name}`,
        `E-mail: ${email}`,
        `Webshop: ${store || "—"}`,
        `Klantvragen per dag: ${volume || "—"}`,
        ``,
        `Bericht:`,
        message || "—",
        ``,
        `Beantwoord deze mail om het moment te bevestigen; je antwoord gaat naar ${email}.`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("[marketing/meeting]", error);
    return NextResponse.json({ error: "Versturen is niet gelukt. Mail ons gerust direct: hallo@sequenceflow.io." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
