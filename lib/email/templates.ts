/**
 * Mails van SequenceFlow zelf die geen eigen tekstbouwer hadden: affiliate-
 * aanmelding, uitbetaling en de inlogcode van de backoffice. Elke functie geeft
 * onderwerp, tekst en HTML (huisstijl uit ./branded.ts). Zonder imports met een
 * alias, zodat de voorbeelden en tests ze kunnen laden.
 */

import { renderBrandedEmail } from "./branded.ts";

const euro = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export function affiliateWelcomeEmail(input: { name: string; link: string; code: string; dashboard: string; holdDays: number }) {
  const first = input.name.trim().split(/\s+/)[0] || input.name;
  const facts = [
    { title: "10% van wat je klanten betalen", text: "Elke maand opnieuw, zolang ze klant blijven, zonder plafond." },
    { title: "Je klant krijgt 10% korting", text: "Op de eerste betaalde maand, als ze via je link komen of je code invullen." },
    { title: "Maandelijks uitbetaald, zonder minimum", text: `Commissie wordt ${input.holdDays} dagen na de betaling van je klant uitbetaalbaar. We betalen uit op de rekening die je in je dashboard invult.` },
  ];
  const text = [
    `Hoi ${first},`,
    "",
    "Welkom bij het affiliateprogramma van SequenceFlow. Het programma is nog in beta: wat je verdient blijft van jou, en wijzigingen hoor je minstens 30 dagen vooraf.",
    "",
    `Jouw affiliatelink: ${input.link}`,
    `Jouw code: ${input.code} (in te vullen bij het aanmelden of tijdens de proef)`,
    `Je dashboard (bewaar deze mail, de link is persoonlijk): ${input.dashboard}`,
    "",
    ...facts.map((fact, index) => `${index + 1}. ${fact.title}. ${fact.text}`),
    "",
    "Vul in je dashboard de rekening in waarop we je commissie overmaken.",
    "",
    "Vragen? Antwoord op deze mail of mail hallo@sequenceflow.io.",
    "",
    "Team SequenceFlow",
  ].join("\n");
  const html = renderBrandedEmail({
    eyebrow: "Affiliateprogramma · beta",
    title: `Welkom, ${first}`,
    preheader: "Je eigen link en je persoonlijke dashboard staan in deze mail.",
    blocks: [
      { type: "paragraph", text: "Je bent aangemeld. Deel je link: wie via jou klant wordt, levert jou elke maand commissie op." },
      { type: "code", caption: "Jouw affiliatelink", value: input.link },
      { type: "code", caption: "Of deel je code (in te vullen bij het aanmelden of tijdens de proef)", value: input.code },
      { type: "button", label: "Open je dashboard", href: input.dashboard },
      { type: "note", text: "Bewaar deze mail: de dashboardknop is persoonlijk en werkt zonder wachtwoord. Stuur hem niet door." },
      { type: "heading", text: "Zo verdien je" },
      { type: "list", items: facts },
      { type: "paragraph", text: "Vul in je dashboard de rekening in waarop we je commissie overmaken. Het programma is nog in beta: wat je verdient blijft van jou, en wijzigingen hoor je minstens 30 dagen vooraf." },
      { type: "paragraph", text: "Vragen? Antwoord op deze mail of mail hallo@sequenceflow.io." },
    ],
    signature: "Team SequenceFlow",
    footer: ["Je krijgt deze mail omdat je je hebt aangemeld als affiliate op sequenceflow.io/nl/affiliate."],
  });
  return { subject: "Je SequenceFlow-affiliatelink", text, html };
}

export function affiliatePayoutEmail(input: { name: string; amountCents: number; vatCents: number; totalCents: number; ibanMasked: string; accountHolder: string; invoiceNumber: string }) {
  const first = input.name.trim().split(/\s+/)[0] || input.name;
  const text = [
    `Hoi ${first},`,
    "",
    `We hebben ${euro(input.totalCents)} overgemaakt naar rekening ${input.ibanMasked} op naam van ${input.accountHolder}.`,
    input.vatCents ? `Dat is ${euro(input.amountCents)} commissie plus ${euro(input.vatCents)} btw.` : `Dat is ${euro(input.amountCents)} commissie.`,
    `Factuurnummer: ${input.invoiceNumber}. De factuur staat in je dashboard (de link uit je aanmeldmail), onder Uitbetalingen.`,
    "",
    "Het kan één tot twee werkdagen duren voor het bedrag op je rekening staat.",
    "",
    "Vragen? Antwoord op deze mail of mail hallo@sequenceflow.io.",
    "",
    "Team SequenceFlow",
  ].join("\n");
  const html = renderBrandedEmail({
    eyebrow: "Affiliateprogramma",
    title: `${euro(input.totalCents)} is onderweg`,
    preheader: `Je commissie is uitbetaald op ${input.ibanMasked}.`,
    blocks: [
      { type: "paragraph", text: `Hoi ${first}, we hebben je commissie overgemaakt. Het kan één tot twee werkdagen duren voor het bedrag op je rekening staat.` },
      { type: "rows", items: [
        { label: "Commissie", value: euro(input.amountCents) },
        ...(input.vatCents ? [{ label: "Btw", value: euro(input.vatCents) }] : []),
        { label: "Totaal overgemaakt", value: euro(input.totalCents) },
        { label: "Rekening", value: input.ibanMasked },
        { label: "Op naam van", value: input.accountHolder },
        { label: "Factuurnummer", value: input.invoiceNumber },
      ] },
      { type: "paragraph", text: "De factuur staat in je dashboard (de link uit je aanmeldmail), onder Uitbetalingen." },
      { type: "paragraph", text: "Vragen? Antwoord op deze mail of mail hallo@sequenceflow.io." },
    ],
    signature: "Team SequenceFlow",
  });
  return { subject: `Je commissie is uitbetaald: ${euro(input.totalCents)}`, text, html };
}

export function backofficeCodeEmail(input: { code: string }) {
  const text = [
    `Je inlogcode: ${input.code}`,
    "",
    "Vul deze code in op sequenceflow.io/backoffice. Daarna vraagt de pagina om de code uit je authenticator-app.",
    "De code is één keer te gebruiken en verloopt vanzelf.",
    "",
    "Heb je dit niet aangevraagd? Dan hoef je niets te doen; zonder je authenticator komt niemand binnen.",
  ].join("\n");
  const html = renderBrandedEmail({
    eyebrow: "Backoffice",
    title: "Je inlogcode",
    preheader: `${input.code} is je inlogcode voor de backoffice.`,
    blocks: [
      { type: "code", value: input.code },
      { type: "paragraph", text: "Vul deze code in op sequenceflow.io/backoffice. Daarna vraagt de pagina om de code uit je authenticator-app. De code is één keer te gebruiken en verloopt vanzelf." },
      { type: "note", text: "Heb je dit niet aangevraagd? Dan hoef je niets te doen; zonder je authenticator komt niemand binnen." },
    ],
  });
  return { subject: `${input.code} is je inlogcode voor SequenceFlow beheer`, text, html };
}
