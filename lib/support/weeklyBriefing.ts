import { createHmac, timingSafeEqual } from "node:crypto";

import { renderBrandedEmail, type MailBlock } from "../email/branded.ts";

/**
 * De wekelijkse mail op maandag: wat Support One vorige week deed, wat er
 * nog op je wacht, de grootste pijnpunten en (met bol.com) de belangrijkste
 * signalen. Alleen gegevens die er al zijn; geen extra AI-aanroep.
 */

export type BriefingInput = {
  nl: boolean;
  shopName: string | null;
  stats: { questions: number; replies: number; autonomous: number; hours: number; euros: number; waiting: number };
  painPoints: Array<{ category: string; count: number; recommended_action: string }>;
  commerce: Array<{ headline: string; recommendedAction: string }>;
  appUrl: string;
  unsubscribeUrl: string;
};

export function weeklyBriefingEmail(input: BriefingInput) {
  const { nl, stats } = input;
  const lines: string[] = [];
  const shop = input.shopName ? (nl ? ` voor ${input.shopName}` : ` for ${input.shopName}`) : "";
  lines.push(nl ? "Hoi," : "Hi,");
  lines.push("");
  lines.push(nl
    ? `Dit deed Support One vorige week${shop}: ${stats.questions} klantvragen binnen, ${stats.replies} antwoorden verstuurd${stats.autonomous ? ` (waarvan ${stats.autonomous} zelfstandig)` : ""}. Dat scheelde je team ongeveer ${stats.hours.toLocaleString("nl-NL")} uur, circa €${stats.euros.toLocaleString("nl-NL")} aan werktijd.`
    : `This is what Support One did last week${shop}: ${stats.questions} customer questions in, ${stats.replies} replies sent${stats.autonomous ? ` (${stats.autonomous} on its own)` : ""}. That saved your team about ${stats.hours.toLocaleString("en-US")} hours, roughly €${stats.euros.toLocaleString("en-US")} of working time.`);
  if (stats.waiting) {
    lines.push("");
    lines.push(nl ? `Wacht op jou: ${stats.waiting} ${stats.waiting === 1 ? "gesprek" : "gesprekken"} in de inbox.` : `Waiting for you: ${stats.waiting} ${stats.waiting === 1 ? "conversation" : "conversations"} in the inbox.`);
  }
  if (input.painPoints.length) {
    lines.push("");
    lines.push(nl ? "Waar klanten tegenaan lopen:" : "Where customers get stuck:");
    input.painPoints.slice(0, 3).forEach((point, index) => {
      lines.push(`${index + 1}. ${point.category} (${point.count} ${nl ? (point.count === 1 ? "vraag" : "vragen") : (point.count === 1 ? "question" : "questions")})`);
      lines.push(`   ${nl ? "Advies" : "Advice"}: ${point.recommended_action}`);
    });
  }
  if (input.commerce.length) {
    lines.push("");
    lines.push(nl ? "Uit je bol.com-gegevens:" : "From your bol.com data:");
    input.commerce.slice(0, 3).forEach((item, index) => lines.push(`${index + 1}. ${item.headline} — ${item.recommendedAction}`));
  }
  lines.push("");
  lines.push(nl ? `Naar Support One: ${input.appUrl}` : `Open Support One: ${input.appUrl}`);
  lines.push("");
  lines.push(nl ? "Groet,\nSeffy van Support One" : "Cheers,\nSeffy from Support One");
  lines.push("");
  lines.push(nl ? `Liever geen wekelijkse mail? Afmelden: ${input.unsubscribeUrl}` : `Prefer no weekly email? Unsubscribe: ${input.unsubscribeUrl}`);

  const subject = nl
    ? `Je week met Support One: ${stats.replies} antwoorden, ~${stats.hours.toLocaleString("nl-NL")} uur bespaard`
    : `Your week with Support One: ${stats.replies} replies, ~${stats.hours.toLocaleString("en-US")} hours saved`;
  const n = (value: number) => value.toLocaleString(nl ? "nl-NL" : "en-US");
  const blocks: MailBlock[] = [
    { type: "paragraph", text: nl ? `Dit deed Support One vorige week${shop}.` : `This is what Support One did last week${shop}.` },
    { type: "stats", items: [
      { label: nl ? "klantvragen binnen" : "customer questions", value: n(stats.questions) },
      { label: nl ? (stats.autonomous ? `antwoorden, ${n(stats.autonomous)} zelfstandig` : "antwoorden verstuurd") : (stats.autonomous ? `replies, ${n(stats.autonomous)} on its own` : "replies sent"), value: n(stats.replies) },
      { label: nl ? "uur bespaard" : "hours saved", value: `~${n(stats.hours)}` },
      { label: nl ? "aan werktijd" : "of working time", value: `€${n(stats.euros)}` },
    ] },
  ];
  if (stats.waiting) blocks.push({ type: "paragraph", text: nl ? `Wacht op jou: ${stats.waiting} ${stats.waiting === 1 ? "gesprek" : "gesprekken"} in de inbox.` : `Waiting for you: ${stats.waiting} ${stats.waiting === 1 ? "conversation" : "conversations"} in the inbox.` });
  if (input.painPoints.length) {
    blocks.push({ type: "heading", text: nl ? "Waar klanten tegenaan lopen" : "Where customers get stuck" });
    blocks.push({ type: "list", items: input.painPoints.slice(0, 3).map((point) => ({
      title: `${point.category} (${point.count} ${nl ? (point.count === 1 ? "vraag" : "vragen") : (point.count === 1 ? "question" : "questions")})`,
      text: `${nl ? "Advies" : "Advice"}: ${point.recommended_action}`,
    })) });
  }
  if (input.commerce.length) {
    blocks.push({ type: "heading", text: nl ? "Uit je bol.com-gegevens" : "From your bol.com data" });
    blocks.push({ type: "list", items: input.commerce.slice(0, 3).map((item) => ({ title: item.headline, text: item.recommendedAction })) });
  }
  blocks.push({ type: "button", label: nl ? "Naar Support One" : "Open Support One", href: input.appUrl });
  const html = renderBrandedEmail({
    language: nl ? "nl" : "en",
    eyebrow: nl ? "Seffy · je week met Support One" : "Seffy · your week with Support One",
    title: nl ? `${n(stats.replies)} antwoorden, ~${n(stats.hours)} uur bespaard` : `${n(stats.replies)} replies, ~${n(stats.hours)} hours saved`,
    preheader: nl ? `${n(stats.questions)} klantvragen vorige week${stats.waiting ? `, ${stats.waiting} wachten op jou` : ""}.` : `${n(stats.questions)} customer questions last week${stats.waiting ? `, ${stats.waiting} waiting for you` : ""}.`,
    blocks,
    signature: nl ? "Groet,\nSeffy van Support One" : "Cheers,\nSeffy from Support One",
    footer: [nl ? `Liever geen wekelijkse mail? Afmelden: ${input.unsubscribeUrl}` : `Prefer no weekly email? Unsubscribe: ${input.unsubscribeUrl}`],
  });
  return { subject, text: lines.join("\n"), html };
}

/** Alleen mailen als er iets te melden is. */
export function shouldSendBriefing(stats: BriefingInput["stats"]) {
  return stats.questions > 0 || stats.replies > 0 || stats.waiting > 0;
}

/** Maandag van de week (UTC) als sleutel, zodat elke week hooguit één mail gaat. */
export function weekKey(now: Date) {
  const day = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

export function unsubscribeSignature(tenantId: string, secret: string) {
  return createHmac("sha256", secret).update(`weekly-briefing:${tenantId}`).digest("hex").slice(0, 32);
}

export function validUnsubscribeSignature(tenantId: string, signature: string, secret: string) {
  const expected = Buffer.from(unsubscribeSignature(tenantId, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
