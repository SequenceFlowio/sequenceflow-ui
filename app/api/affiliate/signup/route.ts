import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/resend";
import { usernameProblem } from "@/lib/referrals/program";
import { createAffiliate } from "@/lib/referrals/server";
import { SITE_ORIGIN } from "@/lib/site";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Aanmelden als affiliate: geen SequenceFlow-account nodig. De persoonlijke dashboardlink gaat per mail. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }
  if (text(body.website, 200)) return NextResponse.json({ ok: true }); // honeypot

  const username = text(body.username, 40);
  const name = text(body.name, 120);
  const email = text(body.email, 200).toLowerCase();
  const isBusiness = body.isBusiness === true;
  const problem = usernameProblem(username);
  if (problem) return NextResponse.json({ error: problem, field: "username" }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "Vul je naam in.", field: "name" }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Vul een geldig e-mailadres in.", field: "email" }, { status: 400 });
  if (body.acceptTerms !== true) return NextResponse.json({ error: "Ga akkoord met de voorwaarden van het programma.", field: "acceptTerms" }, { status: 400 });

  try {
    const result = await createAffiliate({
      username, name, email, isBusiness,
      companyName: text(body.companyName, 160), kvkNumber: text(body.kvkNumber, 20), vatNumber: text(body.vatNumber, 30),
      channel: text(body.channel, 300), showOnLeaderboard: body.showOnLeaderboard !== false,
    });
    if ("error" in result) return NextResponse.json({ error: result.error, field: "username" }, { status: 409 });

    const link = `${SITE_ORIGIN}/r/${result.affiliate.username}`;
    const dashboard = `${SITE_ORIGIN}/affiliate/dashboard/${result.token}`;
    try {
      await sendEmail({
        to: email,
        subject: "Je SequenceFlow-affiliatelink",
        text: [
          `Hoi ${name},`,
          "",
          "Welkom bij het affiliateprogramma van SequenceFlow. Het programma is nog in beta: wat je verdient blijft van jou, en wijzigingen hoor je minstens 30 dagen vooraf.",
          "",
          `Jouw link: ${link}`,
          `Je dashboard (bewaar deze mail, de link is persoonlijk): ${dashboard}`,
          "",
          "Je verdient 5% van wat je eerste 5 klanten betalen, en 10% vanaf klant 6, zolang ze klant blijven.",
          "Commissie wordt 60 dagen na betaling uitbetaalbaar en we betalen maandelijks uit vanaf €50.",
          "",
          "Vragen? Antwoord op deze mail of mail hallo@sequenceflow.io.",
          "",
          "Team SequenceFlow",
        ].join("\n"),
        replyTo: "hallo@sequenceflow.io",
      });
    } catch (error) {
      console.error("[affiliate/signup] mail versturen mislukt", error);
    }
    return NextResponse.json({ ok: true, link, dashboard });
  } catch (error) {
    console.error("[affiliate/signup] mislukt", error);
    return NextResponse.json({ error: "Aanmelden lukte niet. Probeer het later opnieuw." }, { status: 500 });
  }
}
