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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });

  // Honeypot of te snel ingevuld: stil 'gelukt' teruggeven, niets versturen.
  if (clean(body.company, 200) || Number(body.elapsedMs) < 4000) return NextResponse.json({ ok: true });

  if (!(await allowRequest("marketing-intake", clientIp(req), RATE_LIMITS.marketingForm))) {
    return NextResponse.json({ error: "Te veel aanvragen. App of mail ons gerust direct." }, { status: 429 });
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

  if (!goal) return NextResponse.json({ error: "Kies waar we je mee kunnen helpen." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Vul je naam in." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
  if (reach !== "E-mail" && !/^[+()\d\s-]{8,}$/.test(phone)) return NextResponse.json({ error: "Vul een telefoonnummer in, dan kunnen we je appen of bellen." }, { status: 400 });

  try {
    await getResendClient().emails.send({
      from: "SequenceFlow <noreply@mail.sequenceflow.io>",
      to: "hallo@sequenceflow.io",
      replyTo: email,
      subject: `${goal}: ${name}${store ? ` · ${store}` : ""}`,
      text: [
        "Nieuwe aanvraag via /contact.",
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
    return NextResponse.json({ error: "Versturen is niet gelukt. App of mail ons gerust direct." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
