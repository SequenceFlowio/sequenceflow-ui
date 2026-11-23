/**
 * Mails van SequenceFlow zelf die geen eigen tekstbouwer hadden: affiliate-
 * aanmelding, uitbetaling en de inlogcode van de backoffice. Elke functie geeft
 * onderwerp, tekst en HTML (huisstijl uit ./branded.ts). Zonder imports met een
 * alias, zodat de voorbeelden en tests ze kunnen laden.
 */

import { renderBrandedEmail } from "./branded.ts";

export type MailLanguage = "nl" | "en";

const euro = (cents: number, language: MailLanguage = "nl") => new Intl.NumberFormat(language === "en" ? "en-IE" : "nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** Welkomstmail voor een nieuwe affiliate, in de taal van de pagina waarop hij zich aanmeldde. */
export function affiliateWelcomeEmail(input: { name: string; link: string; code: string; dashboard: string; holdDays: number; language?: MailLanguage }) {
  const en = input.language === "en";
  const first = input.name.trim().split(/\s+/)[0] || input.name;
  const facts = en ? [
    { title: "10% of what your customers pay", text: "Every month, for as long as they stay a customer, with no cap." },
    { title: "Your customer gets 10% off", text: "On their first paid month, when they come through your link or enter your code." },
    { title: "Paid monthly, no minimum", text: `Commission becomes payable ${input.holdDays} days after your customer pays. We pay out to the account you enter in your dashboard.` },
  ] : [
    { title: "10% van wat je klanten betalen", text: "Elke maand opnieuw, zolang ze klant blijven, zonder plafond." },
    { title: "Je klant krijgt 10% korting", text: "Op de eerste betaalde maand, als ze via je link komen of je code invullen." },
    { title: "Maandelijks uitbetaald, zonder minimum", text: `Commissie wordt ${input.holdDays} dagen na de betaling van je klant uitbetaalbaar. We betalen uit op de rekening die je in je dashboard invult.` },
  ];
  const t = en ? {
    hi: `Hi ${first},`,
    intro: "Welcome to the SequenceFlow affiliate programme. The programme is still in beta: what you earn stays yours, and you'll hear about changes at least 30 days in advance.",
    link: "Your affiliate link", code: "Your code", codeHint: "to enter when signing up or during the trial",
    dashboard: "Your dashboard (keep this email, the link is personal)",
    account: "Enter the account we should pay your commission into in your dashboard.",
    questions: "Questions? Reply to this email or write to hallo@sequenceflow.io.",
    eyebrow: "Affiliate programme · beta", title: `Welcome, ${first}`,
    preheader: "Your own link and your personal dashboard are in this email.",
    signedUp: "You're signed up. Share your link: everyone who becomes a customer through you earns you commission every month.",
    shareCode: "Or share your code (to enter when signing up or during the trial)",
    open: "Open your dashboard",
    keep: "Keep this email: the dashboard button is personal and works without a password. Don't forward it.",
    how: "How you earn",
    beta: "Enter the account we should pay your commission into in your dashboard. The programme is still in beta: what you earn stays yours, and you'll hear about changes at least 30 days in advance.",
    why: "You're receiving this email because you signed up as an affiliate at sequenceflow.io/en/affiliate.",
    subject: "Your SequenceFlow affiliate link",
  } : {
    hi: `Hoi ${first},`,
    intro: "Welkom bij het affiliateprogramma van SequenceFlow. Het programma is nog in beta: wat je verdient blijft van jou, en wijzigingen hoor je minstens 30 dagen vooraf.",
    link: "Jouw affiliatelink", code: "Jouw code", codeHint: "in te vullen bij het aanmelden of tijdens de proef",
    dashboard: "Je dashboard (bewaar deze mail, de link is persoonlijk)",
    account: "Vul in je dashboard de rekening in waarop we je commissie overmaken.",
    questions: "Vragen? Antwoord op deze mail of mail hallo@sequenceflow.io.",
    eyebrow: "Affiliateprogramma · beta", title: `Welkom, ${first}`,
    preheader: "Je eigen link en je persoonlijke dashboard staan in deze mail.",
    signedUp: "Je bent aangemeld. Deel je link: wie via jou klant wordt, levert jou elke maand commissie op.",
    shareCode: "Of deel je code (in te vullen bij het aanmelden of tijdens de proef)",
    open: "Open je dashboard",
    keep: "Bewaar deze mail: de dashboardknop is persoonlijk en werkt zonder wachtwoord. Stuur hem niet door.",
    how: "Zo verdien je",
    beta: "Vul in je dashboard de rekening in waarop we je commissie overmaken. Het programma is nog in beta: wat je verdient blijft van jou, en wijzigingen hoor je minstens 30 dagen vooraf.",
    why: "Je krijgt deze mail omdat je je hebt aangemeld als affiliate op sequenceflow.io/nl/affiliate.",
    subject: "Je SequenceFlow-affiliatelink",
  };
  const text = [
    t.hi, "", t.intro, "",
    `${t.link}: ${input.link}`,
    `${t.code}: ${input.code} (${t.codeHint})`,
    `${t.dashboard}: ${input.dashboard}`,
    "",
    ...facts.map((fact, index) => `${index + 1}. ${fact.title}. ${fact.text}`),
    "", t.account, "", t.questions, "", "Team SequenceFlow",
  ].join("\n");
  const html = renderBrandedEmail({
    language: en ? "en" : "nl",
    eyebrow: t.eyebrow,
    title: t.title,
    preheader: t.preheader,
    blocks: [
      { type: "paragraph", text: t.signedUp },
      { type: "code", caption: t.link, value: input.link },
      { type: "code", caption: t.shareCode, value: input.code },
      { type: "button", label: t.open, href: input.dashboard },
      { type: "note", text: t.keep },
      { type: "heading", text: t.how },
      { type: "list", items: facts },
      { type: "paragraph", text: t.beta },
      { type: "paragraph", text: t.questions },
    ],
    signature: "Team SequenceFlow",
    footer: [t.why],
  });
  return { subject: t.subject, text, html };
}

/** Mail na een uitbetaling, in de taal van de affiliate. */
export function affiliatePayoutEmail(input: { name: string; amountCents: number; vatCents: number; totalCents: number; ibanMasked: string; accountHolder: string; invoiceNumber: string; language?: MailLanguage }) {
  const lang: MailLanguage = input.language === "en" ? "en" : "nl";
  const en = lang === "en";
  const e = (cents: number) => euro(cents, lang);
  const first = input.name.trim().split(/\s+/)[0] || input.name;
  const t = en ? {
    hi: `Hi ${first},`,
    sent: `We've transferred ${e(input.totalCents)} to account ${input.ibanMasked} in the name of ${input.accountHolder}.`,
    split: input.vatCents ? `That's ${e(input.amountCents)} commission plus ${e(input.vatCents)} VAT.` : `That's ${e(input.amountCents)} commission.`,
    invoice: `Invoice number: ${input.invoiceNumber}. The invoice is in your dashboard (the link from your sign-up email), under Payouts.`,
    days: "It can take one to two working days before the amount shows in your account.",
    questions: "Questions? Reply to this email or write to hallo@sequenceflow.io.",
    eyebrow: "Affiliate programme", title: `${e(input.totalCents)} is on its way`,
    preheader: `Your commission has been paid to ${input.ibanMasked}.`,
    lead: `Hi ${first}, we've transferred your commission. It can take one to two working days before the amount shows in your account.`,
    rows: ["Commission", "VAT", "Total transferred", "Account", "In the name of", "Invoice number"],
    where: "The invoice is in your dashboard (the link from your sign-up email), under Payouts.",
    subject: `Your commission has been paid: ${e(input.totalCents)}`,
  } : {
    hi: `Hoi ${first},`,
    sent: `We hebben ${e(input.totalCents)} overgemaakt naar rekening ${input.ibanMasked} op naam van ${input.accountHolder}.`,
    split: input.vatCents ? `Dat is ${e(input.amountCents)} commissie plus ${e(input.vatCents)} btw.` : `Dat is ${e(input.amountCents)} commissie.`,
    invoice: `Factuurnummer: ${input.invoiceNumber}. De factuur staat in je dashboard (de link uit je aanmeldmail), onder Uitbetalingen.`,
    days: "Het kan één tot twee werkdagen duren voor het bedrag op je rekening staat.",
    questions: "Vragen? Antwoord op deze mail of mail hallo@sequenceflow.io.",
    eyebrow: "Affiliateprogramma", title: `${e(input.totalCents)} is onderweg`,
    preheader: `Je commissie is uitbetaald op ${input.ibanMasked}.`,
    lead: `Hoi ${first}, we hebben je commissie overgemaakt. Het kan één tot twee werkdagen duren voor het bedrag op je rekening staat.`,
    rows: ["Commissie", "Btw", "Totaal overgemaakt", "Rekening", "Op naam van", "Factuurnummer"],
    where: "De factuur staat in je dashboard (de link uit je aanmeldmail), onder Uitbetalingen.",
    subject: `Je commissie is uitbetaald: ${e(input.totalCents)}`,
  };
  const text = [t.hi, "", t.sent, t.split, t.invoice, "", t.days, "", t.questions, "", "Team SequenceFlow"].join("\n");
  const html = renderBrandedEmail({
    language: lang,
    eyebrow: t.eyebrow,
    title: t.title,
    preheader: t.preheader,
    blocks: [
      { type: "paragraph", text: t.lead },
      { type: "rows", items: [
        { label: t.rows[0], value: e(input.amountCents) },
        ...(input.vatCents ? [{ label: t.rows[1], value: e(input.vatCents) }] : []),
        { label: t.rows[2], value: e(input.totalCents) },
        { label: t.rows[3], value: input.ibanMasked },
        { label: t.rows[4], value: input.accountHolder },
        { label: t.rows[5], value: input.invoiceNumber },
      ] },
      { type: "paragraph", text: t.where },
      { type: "paragraph", text: t.questions },
    ],
    signature: "Team SequenceFlow",
  });
  return { subject: t.subject, text, html };
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
