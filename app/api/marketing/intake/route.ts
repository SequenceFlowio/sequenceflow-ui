import { NextRequest, NextResponse } from "next/server";

import { getResendClient } from "@/lib/email/outbound/resendClient";
import { CONTACT_INTAKE } from "@/lib/marketing/contactIntake";
import { RATE_LIMITS, allowRequest, clientIp } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

/**
 * De vragenlijst op /contact (drie stappen) → mail naar hallo@sequenceflow.io.
 * Zelfde bescherming als het kennismakingsformulier: honeypot, minimale
 * invultijd, limiet per IP, en alleen keuzes die we zelf aanbieden. Er gaat
 * bewust geen mail naar de aanvrager: een openbaar formulier dat naar
 * willekeurige adressen mailt, is misbruikbaar.
 */

const clean = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const label = (options: ReadonlyArray<{ id: string; label: string }>, id: unknown) => options.find((option) => option.id === id)?.label ?? null;

const MESSAGES = {
  nl: {
    invalid: "Ongeldige aanvraag.",
    tooMany: "Te veel aanvragen. App of mail ons gerust direct.",
    goal: "Kies waar we je mee kunnen helpen.",
    name: "Vul je naam in.",
    email: "Vul een geldig e-mailadres in.",
    phone: "Vul een telefoonnummer in, dan kunnen we je appen of bellen.",
    failed: "Versturen is niet gelukt. App of mail ons gerust direct.",
  },
  en: {
    invalid: "Invalid request.",
    tooMany: "Too many requests. Feel free to message or email us directly.",
    goal: "Choose what we can help you with.",
    name: "Please enter your name.",
    email: "Please enter a valid email address.",
    phone: "Please enter a phone number so we can message or call you.",
    failed: "Sending failed. Feel free to message or email us directly.",
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: MESSAGES.nl.invalid }, { status: 400 });
  const lang = body.lang === "en" ? "en" : "nl";
  const t = MESSAGES[lang];

  // Honeypot of te snel ingevuld: stil 'gelukt' teruggeven, niets versturen.
  if (clean(body.company, 200) || Number(body.elapsedMs) < 4000) return NextResponse.json({ ok: true });

  if (!(await allowRequest("marketing-intake", clientIp(req), RATE_LIMITS.marketingForm))) {
    return NextResponse.json({ error: t.tooMany }, { status: 429 });
  }

  const goal = label(CONTACT_INTAKE.goals, body.goal);
  const volume = label(CONTACT_INTAKE.volumes, body.volume);
  const reach = label(CONTACT_INTAKE.reach, body.reach) ?? "E-mail";
  const platforms = (Array.isArray(body.platforms) ? body.platforms : [])
    .map((id) => label(CONTACT_INTAKE.platforms, id)).filter(Boolean) as string[];
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const phone = clean(body.phone, 40);
  const store = clean(body.store, 200);
  const message = String(body.message ?? "").trim().slice(0, 1500);

  if (!goal) return NextResponse.json({ error: t.goal }, { status: 400 });
  if (!name) return NextResponse.json({ error: t.name }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: t.email }, { status: 400 });
  if (reach !== "E-mail" && !/^[+()\d\s-]{8,}$/.test(phone)) return NextResponse.json({ error: t.phone }, { status: 400 });

  try {
    await getResendClient().emails.send({
      from: "SequenceFlow <noreply@mail.sequenceflow.io>",
      to: "hallo@sequenceflow.io",
      replyTo: email,
      subject: `${lang === "en" ? "[EN] " : ""}${goal}: ${name}${store ? ` · ${store}` : ""}`,
      text: [
        `Nieuwe aanvraag via /${lang}/contact.`,
        ...(lang === "en" ? ["Taal: Engels — antwoord in het Engels."] : []),
        "",
        `Waarvoor: ${goal}`,
        `Platform: ${platforms.join(", ") || "—"}`,
        `Klantmails per dag: ${volume || "—"}`,
        `Webshop: ${store || "—"}`,
        "",
        `Naam: ${name}`,
        `E-mail: ${email}`,
        `Telefoon: ${phone || "—"}`,
        `Liefst contact via: ${reach}`,
        "",
        "Bericht:",
        message || "—",
      ].join("\n"),
    });
  } catch (error) {
    console.error("[marketing/intake]", error);
    return NextResponse.json({ error: t.failed }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
