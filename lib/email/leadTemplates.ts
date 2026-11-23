/**
 * Mails aan wie zich aanmeldt op de Academy-pagina's (/nl/academy, /en/academy):
 * 1. direct: de link naar de download, of bij de wachtlijst een bevestiging (altijd, ze vroegen er zelf om);
 * 2. alleen met het vinkje "stuur me ook tips": een korte reeks van drie mails
 *    over Support One (dag 2, 5 en 9), elk met een afmeldlink.
 * Taal = de taal van de pagina waarop ze de download ophaalden.
 * Zonder imports met een alias, zodat de voorbeelden en tests ze kunnen laden.
 */

import { renderBrandedEmail, type MailBlock } from "./branded.ts";
import type { MailLanguage } from "./templates.ts";

const SITE = "https://www.sequenceflow.io";

function footer(language: MailLanguage, unsubscribeUrl: string | null, marketing: boolean) {
  const en = language === "en";
  if (marketing && unsubscribeUrl) {
    return [en
      ? `You're receiving this because you signed up for the SequenceFlow Academy and asked for tips. Unsubscribe: ${unsubscribeUrl}`
      : `Je krijgt deze mail omdat je je aanmeldde bij de SequenceFlow Academy en om tips vroeg. Afmelden: ${unsubscribeUrl}`];
  }
  return [en
    ? "You're receiving this because you signed up on sequenceflow.io. We'll only email you about the Academy, unless you asked for tips."
    : "Je krijgt deze mail omdat je je aanmeldde op sequenceflow.io. We mailen je alleen over de Academy, tenzij je om tips vroeg."];
}

/** Direct na het ophalen: de link, zodat ze hem ook op een ander apparaat terugvinden. */
export function leadDownloadEmail(input: { language: MailLanguage; name?: string | null; title: string; link: string; marketing: boolean; unsubscribeUrl: string | null; kind?: "download" | "waitlist"; bonusLink?: string }) {
  const en = input.language === "en";
  const hi = input.name ? (en ? `Hi ${input.name},` : `Hoi ${input.name},`) : (en ? "Hi," : "Hoi,");
  const t = input.kind === "waitlist" ? (en ? {
    subject: "You're on the list: SequenceFlow Academy", eyebrow: "SequenceFlow Academy", title: "You're on the list",
    intro: "As soon as the first explainer videos are online, you'll get an email with the link. Short lessons of around 5 minutes, for online store owners.",
    button: "View the Academy",
    next: input.bonusLink ? `Can't wait? The Reply Bank (30 ready-to-send customer emails) is already available: ${input.bonusLink}` : "Talk soon.",
  } : {
    subject: "Je staat op de lijst: SequenceFlow Academy", eyebrow: "SequenceFlow Academy", title: "Je staat op de lijst",
    intro: "Zodra de eerste uitlegvideo's online staan, krijg je een mail met de link. Korte lessen van zo'n 5 minuten, voor webshopondernemers.",
    button: "Bekijk de Academy",
    next: input.bonusLink ? `Niet zo lang wachten? De Antwoordenbank (30 kant-en-klare klantmails) staat al klaar: ${input.bonusLink}` : "Tot snel.",
  }) : en ? {
    subject: `Your download: ${input.title}`, eyebrow: "SequenceFlow Academy", title: input.title,
    intro: "Here's your download. The link below opens it straight away, on any device.", button: "Open the download",
    next: input.marketing ? "Over the next week or so you'll get three short emails with tips that go with it. Not useful? Unsubscribe with one click below." : "Enjoy it. If a reply in there saves you time, it's done its job.",
  } : {
    subject: `Je download: ${input.title}`, eyebrow: "SequenceFlow Academy", title: input.title,
    intro: "Hier is je download. De link hieronder opent hem meteen, op elk apparaat.", button: "Open de download",
    next: input.marketing ? "De komende week krijg je nog drie korte mails met tips die erbij horen. Niets voor jou? Met één klik hieronder afmelden." : "Veel plezier ermee. Scheelt één antwoord je tijd, dan heeft hij z'n werk gedaan.",
  };
  const text = [hi, "", t.intro, "", `${t.button}: ${input.link}`, "", t.next, "", "Team SequenceFlow", "", ...footer(input.language, input.unsubscribeUrl, input.marketing)].join("\n");
  const html = renderBrandedEmail({
    language: input.language, eyebrow: t.eyebrow, title: t.title, preheader: t.intro,
    blocks: [{ type: "paragraph", text: `${hi} ${t.intro}` }, { type: "button", label: t.button, href: input.link }, { type: "paragraph", text: t.next }],
    signature: "Team SequenceFlow",
    footer: footer(input.language, input.unsubscribeUrl, input.marketing),
  });
  return { subject: t.subject, text, html };
}

type NurtureCopy = { subject: string; title: string; preheader: string; blocks: MailBlock[]; plain: string[] };

/** Na hoeveel dagen (sinds de download) elke mail uit de reeks gaat. */
export const NURTURE_DAYS = [2, 5, 9] as const;

function nurtureCopy(step: number, en: boolean): NurtureCopy {
  const trial = `${SITE}/login?intent=signup&source=nurture-${step}`;
  if (step === 1) return en ? {
    subject: "Why the same 30 questions keep coming back",
    title: "The same questions, every week",
    preheader: "Most customer emails are about things you already know.",
    plain: [
      "Most customer emails aren't really questions. They're about things you already know: where the parcel is, how returns work, where the invoice is.",
      "Three quick fixes that take the most off your plate:",
      "1. Put the tracking link and the expected delivery day in your shipping email.",
      "2. Link to your returns form at the bottom of every order email.",
      "3. Attach the invoice to the confirmation by default.",
      "What's left are the questions that really need an answer. More on that in a few days.",
    ],
    blocks: [
      { type: "paragraph", text: "Most customer emails aren't really questions. They're about things you already know: where the parcel is, how returns work, where the invoice is." },
      { type: "heading", text: "Three quick fixes" },
      { type: "list", ordered: true, items: [
        { title: "Tracking link and delivery day", text: "In your shipping email, not just the link." },
        { title: "Returns form", text: "Linked at the bottom of every order email." },
        { title: "Invoice", text: "Attached to the confirmation by default." },
      ] },
      { type: "paragraph", text: "What's left are the questions that really need an answer. More on that in a few days." },
    ],
  } : {
    subject: "Waarom dezelfde 30 vragen elke week terugkomen",
    title: "Elke week dezelfde vragen",
    preheader: "De meeste klantmails gaan over dingen die je al weet.",
    plain: [
      "De meeste klantmails zijn eigenlijk geen vragen. Ze gaan over dingen die je al weet: waar het pakket is, hoe retourneren werkt, waar de factuur is.",
      "Drie snelle aanpassingen die het meeste schelen:",
      "1. Zet de track & trace én de verwachte bezorgdag in je verzendmail.",
      "2. Link onderaan elke bestelmail naar je retourformulier.",
      "3. Stuur de factuur standaard mee met de bevestiging.",
      "Wat overblijft zijn de vragen die echt een antwoord nodig hebben. Daarover over een paar dagen meer.",
    ],
    blocks: [
      { type: "paragraph", text: "De meeste klantmails zijn eigenlijk geen vragen. Ze gaan over dingen die je al weet: waar het pakket is, hoe retourneren werkt, waar de factuur is." },
      { type: "heading", text: "Drie snelle aanpassingen" },
      { type: "list", ordered: true, items: [
        { title: "Track & trace én bezorgdag", text: "In je verzendmail, niet alleen de link." },
        { title: "Retourformulier", text: "Onderaan elke bestelmail gelinkt." },
        { title: "Factuur", text: "Standaard mee met de bevestiging." },
      ] },
      { type: "paragraph", text: "Wat overblijft zijn de vragen die echt een antwoord nodig hebben. Daarover over een paar dagen meer." },
    ],
  };
  if (step === 2) return en ? {
    subject: "This is how Seffy answers them for you",
    title: "You approve, Seffy does the rest",
    preheader: "An AI colleague that reads the email, looks up the order and drafts the reply.",
    plain: [
      "Seffy is the AI colleague in Support One. When a customer emails, Seffy reads the question, looks up the order in your store and drafts a reply in your tone.",
      "You check it and press send. Once you trust a type of question, Seffy can handle it on its own. You decide per type of question.",
      "Like the replies in our Reply Bank, but filled in with the real order details.",
      `See how it works: ${SITE}/en`,
    ],
    blocks: [
      { type: "paragraph", text: "Seffy is the AI colleague in Support One. When a customer emails, Seffy reads the question, looks up the order in your store and drafts a reply in your tone." },
      { type: "paragraph", text: "You check it and press send. Once you trust a type of question, Seffy can handle it on its own. You decide per type of question." },
      { type: "note", text: "Like the replies in our Reply Bank, but filled in with the real order details." },
      { type: "button", label: "See how it works", href: `${SITE}/en` },
    ],
  } : {
    subject: "Zo beantwoordt Seffy ze voor je",
    title: "Jij keurt goed, Seffy doet de rest",
    preheader: "Een AI-collega die de mail leest, de bestelling opzoekt en het antwoord klaarzet.",
    plain: [
      "Seffy is de AI-collega in Support One. Mailt een klant, dan leest Seffy de vraag, zoekt de bestelling op in je webshop en zet een antwoord klaar in jouw toon.",
      "Jij kijkt het na en drukt op versturen. Vertrouw je een soort vraag, dan mag Seffy hem zelf afhandelen. Dat bepaal jij per soort vraag.",
      "Net als de antwoorden uit onze Antwoordenbank, maar dan ingevuld met de echte bestelgegevens.",
      `Bekijk hoe het werkt: ${SITE}/nl`,
    ],
    blocks: [
      { type: "paragraph", text: "Seffy is de AI-collega in Support One. Mailt een klant, dan leest Seffy de vraag, zoekt de bestelling op in je webshop en zet een antwoord klaar in jouw toon." },
      { type: "paragraph", text: "Jij kijkt het na en drukt op versturen. Vertrouw je een soort vraag, dan mag Seffy hem zelf afhandelen. Dat bepaal jij per soort vraag." },
      { type: "note", text: "Net als de antwoorden uit onze Antwoordenbank, maar dan ingevuld met de echte bestelgegevens." },
      { type: "button", label: "Bekijk hoe het werkt", href: `${SITE}/nl` },
    ],
  };
  return en ? {
    subject: "Try Support One free for 14 days",
    title: "14 days free, no credit card",
    preheader: "Connect your support inbox and see what Seffy does with your own emails.",
    plain: [
      "The quickest way to see if Support One is for you: try it on your own inbox.",
      "14 days free, 150 AI answers, no credit card. Connecting your mailbox takes a few minutes, and nothing gets sent without your approval.",
      `Start your free trial: ${trial}`,
      "Questions first? Just reply to this email.",
    ],
    blocks: [
      { type: "paragraph", text: "The quickest way to see if Support One is for you: try it on your own inbox." },
      { type: "stats", items: [{ label: "Free", value: "14 days" }, { label: "AI answers", value: "150" }, { label: "Credit card", value: "None" }] },
      { type: "paragraph", text: "Connecting your mailbox takes a few minutes, and nothing gets sent without your approval." },
      { type: "button", label: "Start your free trial", href: trial },
      { type: "paragraph", text: "Questions first? Just reply to this email." },
    ],
  } : {
    subject: "Probeer Support One 14 dagen gratis",
    title: "14 dagen gratis, zonder creditcard",
    preheader: "Koppel je supportmailbox en zie wat Seffy met jouw eigen mails doet.",
    plain: [
      "De snelste manier om te zien of Support One iets voor je is: probeer het op je eigen inbox.",
      "14 dagen gratis, 150 AI-antwoorden, geen creditcard. Je mailbox koppelen kost een paar minuten, en er gaat niets weg zonder dat jij het goedkeurt.",
      `Start je gratis proef: ${trial}`,
      "Eerst een vraag? Antwoord gewoon op deze mail.",
    ],
    blocks: [
      { type: "paragraph", text: "De snelste manier om te zien of Support One iets voor je is: probeer het op je eigen inbox." },
      { type: "stats", items: [{ label: "Gratis", value: "14 dagen" }, { label: "AI-antwoorden", value: "150" }, { label: "Creditcard", value: "Geen" }] },
      { type: "paragraph", text: "Je mailbox koppelen kost een paar minuten, en er gaat niets weg zonder dat jij het goedkeurt." },
      { type: "button", label: "Start je gratis proef", href: trial },
      { type: "paragraph", text: "Eerst een vraag? Antwoord gewoon op deze mail." },
    ],
  };
}

/** Mail `step` (1, 2 of 3) uit de reeks. */
export function leadNurtureEmail(input: { step: number; language: MailLanguage; name?: string | null; unsubscribeUrl: string }) {
  const en = input.language === "en";
  const copy = nurtureCopy(input.step, en);
  const hi = input.name ? (en ? `Hi ${input.name},` : `Hoi ${input.name},`) : (en ? "Hi," : "Hoi,");
  const sign = en ? "Seffy\nSupport One · SequenceFlow" : "Seffy\nSupport One · SequenceFlow";
  const text = [hi, "", ...copy.plain.flatMap((line) => [line, ""]), sign, "", ...footer(input.language, input.unsubscribeUrl, true)].join("\n");
  const html = renderBrandedEmail({
    language: input.language, eyebrow: en ? "Tips · Support One" : "Tips · Support One", title: copy.title, preheader: copy.preheader,
    blocks: [{ type: "paragraph", text: hi }, ...copy.blocks],
    signature: sign,
    footer: footer(input.language, input.unsubscribeUrl, true),
  });
  return { subject: copy.subject, text, html };
}
