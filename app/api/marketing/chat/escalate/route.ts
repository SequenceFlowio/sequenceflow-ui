import { NextRequest, NextResponse } from "next/server";

import { getResendClient } from "@/lib/email/outbound/resendClient";
import { CHAT_LIMITS } from "@/lib/marketing/siteChat";

export const runtime = "nodejs";

/**
 * "Spreek een mens" uit de websitechat → mail met het gesprek naar
 * hallo@sequenceflow.io. Alleen platte tekst: het gesprek komt van een
 * bezoeker en mag nooit als HTML in onze mailbox belanden.
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

const clean = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });

  // Honeypot: stil 'gelukt' teruggeven, niets versturen.
  if (clean(body.company, 200)) return NextResponse.json({ ok: true });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "Te veel aanvragen. Mail ons gerust direct: hallo@sequenceflow.io." }, { status: 429 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const page = clean(body.page, 200);
  const transcript = Array.isArray(body.messages)
    ? body.messages
      .slice(-CHAT_LIMITS.messages)
      .map((item) => item as { role?: unknown; text?: unknown })
      .map((item) => `${item.role === "user" ? "Bezoeker" : "Assistent"}: ${String(item.text ?? "").slice(0, CHAT_LIMITS.messageChars)}`)
      .join("\n\n")
      .slice(0, CHAT_LIMITS.transcriptChars)
    : "";

  if (!name) return NextResponse.json({ error: "Vul je naam in." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });

  try {
    await getResendClient().emails.send({
      from: "SequenceFlow <noreply@mail.sequenceflow.io>",
      to: "hallo@sequenceflow.io",
      replyTo: email,
      subject: `Websitechat: ${name} wil persoonlijk contact`,
      text: [
        "Een bezoeker vraagt via de websitechat om persoonlijk contact.",
        "",
        `Naam: ${name}`,
        `E-mail: ${email}`,
        `Pagina: ${page || "—"}`,
        "",
        "--- Gesprek ---",
        "",
        transcript || "—",
        "",
        `Beantwoord deze mail; je antwoord gaat naar ${email}.`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("[marketing/chat/escalate]", error);
    return NextResponse.json({ error: "Versturen is niet gelukt. Mail ons gerust direct: hallo@sequenceflow.io." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
