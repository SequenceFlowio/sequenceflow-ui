import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/resend";
import { affiliateWelcomeEmail } from "@/lib/email/templates";
import { AFFILIATE, usernameProblem } from "@/lib/referrals/program";
import { createAffiliate } from "@/lib/referrals/server";
import { SITE_ORIGIN } from "@/lib/site";
import { RATE_LIMITS, allowRequest, clientIp } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const MESSAGES = {
  nl: {
    name: "Vul je naam in.",
    email: "Vul een geldig e-mailadres in.",
    terms: "Ga akkoord met de voorwaarden van het programma.",
    tooMany: "Te veel aanmeldingen achter elkaar. Probeer het over een uur opnieuw of mail hallo@sequenceflow.io.",
    taken: "Deze gebruikersnaam is al bezet.",
    failed: "Aanmelden lukte niet. Probeer het later opnieuw.",
  },
  en: {
    name: "Please enter your name.",
    email: "Please enter a valid email address.",
    terms: "Please agree to the programme rules.",
    tooMany: "Too many sign-ups in a row. Try again in an hour or email hallo@sequenceflow.io.",
    taken: "This username is already taken.",
    failed: "Signing up failed. Please try again later.",
  },
};

/** Aanmelden als affiliate: geen SequenceFlow-account nodig. De persoonlijke dashboardlink gaat per mail. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }
  if (text(body.website, 200)) return NextResponse.json({ ok: true }); // honeypot
  const lang = body.lang === "en" ? "en" : "nl";
  const t = MESSAGES[lang];

  const username = text(body.username, 40);
  const name = text(body.name, 120);
  const email = text(body.email, 200).toLowerCase();
  const isBusiness = body.isBusiness === true;
  const problem = usernameProblem(username, lang);
  if (problem) return NextResponse.json({ error: problem, field: "username" }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: t.name, field: "name" }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: t.email, field: "email" }, { status: 400 });
  if (body.acceptTerms !== true) return NextResponse.json({ error: t.terms, field: "acceptTerms" }, { status: 400 });

  // Openbaar formulier dat een mail verstuurt: beperk per IP en per adres.
  const [ipAllowed, emailAllowed] = await Promise.all([
    allowRequest("affiliate-signup-ip", clientIp(req), RATE_LIMITS.affiliateSignupIp),
    allowRequest("affiliate-signup-email", email, RATE_LIMITS.affiliateSignupEmail),
  ]);
  if (!ipAllowed || !emailAllowed) {
    return NextResponse.json({ error: t.tooMany }, { status: 429 });
  }

  try {
    const result = await createAffiliate({
      username, name, email, isBusiness,
      companyName: text(body.companyName, 160), kvkNumber: text(body.kvkNumber, 20), vatNumber: text(body.vatNumber, 30),
      channel: text(body.channel, 300), showOnLeaderboard: body.showOnLeaderboard !== false,
    });
    if ("error" in result) return NextResponse.json({ error: lang === "en" ? t.taken : result.error, field: "username" }, { status: 409 });

    const link = `${SITE_ORIGIN}/r/${result.affiliate.username}`;
    const dashboard = `${SITE_ORIGIN}/affiliate/dashboard/${result.token}`;
    try {
      const mail = affiliateWelcomeEmail({ name, link, code: result.affiliate.username, dashboard, holdDays: AFFILIATE.holdDays });
      await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html, replyTo: "hallo@sequenceflow.io" });
    } catch (error) {
      console.error("[affiliate/signup] mail versturen mislukt", error);
    }
    return NextResponse.json({ ok: true, link, dashboard });
  } catch (error) {
    console.error("[affiliate/signup] mislukt", error);
    return NextResponse.json({ error: t.failed }, { status: 500 });
  }
}
