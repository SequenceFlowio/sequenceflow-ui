import { NextRequest, NextResponse } from "next/server";

import { getResendClient } from "@/lib/email/outbound/resendClient";

export const runtime = "nodejs";

/**
 * Wachtlijst (nu: de Content One-beta) → mail naar hallo@sequenceflow.io.
 * Openbaar formulier, dus een honeypot, een minimale invultijd en een limiet
 * per IP, net als het kennismakingsformulier. Er gaat bewust geen mail naar
 * de aanmelder: een formulier dat naar willekeurige adressen mailt, is
 * misbruikbaar.
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

const PRODUCTS: Record<string, string> = { content: "Content One-beta" };
const clean = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });

  // Honeypot of te snel ingevuld: stil 'gelukt' teruggeven, niets versturen.
  if (clean(body.company, 200) || Number(body.elapsedMs) < 1500) return NextResponse.json({ ok: true });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Te veel aanmeldingen. Mail ons gerust: hallo@sequenceflow.io." }, { status: 429 });

  const email = clean(body.email, 200).toLowerCase();
  const product = PRODUCTS[clean(body.product, 40)] ?? PRODUCTS.content;
  const page = clean(body.page, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });

  try {
    await getResendClient().emails.send({
      from: "SequenceFlow <noreply@mail.sequenceflow.io>",
      to: "hallo@sequenceflow.io",
      replyTo: email,
      subject: `Wachtlijst ${product}: ${email}`,
      text: [`Nieuwe aanmelding voor de ${product}.`, "", `E-mail: ${email}`, `Pagina: ${page || "—"}`].join("\n"),
    });
  } catch (error) {
    console.error("[marketing/waitlist]", error);
    return NextResponse.json({ error: "Aanmelden is niet gelukt. Mail ons gerust: hallo@sequenceflow.io." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
