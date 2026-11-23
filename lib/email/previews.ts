/**
 * Voorbeelden van elke mail in huisstijl, met verzonnen gegevens, in het
 * Nederlands én Engels. Voor het tabblad Mails in de backoffice en voor de
 * tests. Per mail staat erbij wie hem krijgt en waar de taal vandaan komt.
 * Zonder imports met een alias.
 */

import { alertEmail } from "../inventory/alertsCore.ts";
import { weeklyInventoryEmail } from "../inventory/emailCore.ts";
import { weeklyBriefingEmail } from "../support/weeklyBriefing.ts";
import { budgetAlertEmail } from "../billing/budgetAlertEmail.ts";
import { brandedFromText } from "./branded.ts";
import { mailboxAlertText } from "./mailboxAlertText.ts";
import { noticeEmail } from "../backoffice/notifyCore.ts";
import { authEmail } from "./authTemplates.ts";
import { leadDownloadEmail, leadNurtureEmail, NURTURE_DAYS } from "./leadTemplates.ts";
import { affiliatePayoutEmail, affiliateWelcomeEmail, backofficeCodeEmail, type MailLanguage } from "./templates.ts";

export type MailGroup = "Klanten (webshops)" | "Inloggen" | "Affiliates" | "Gratis kennis" | "Intern";

export type MailPreview = {
  key: string;
  group: MailGroup;
  name: string;
  to: string;
  /** Waar de taal van deze mail vandaan komt; "Altijd Nederlands" voor interne mails. */
  languageSource: string;
  /** Extra uitleg, bijvoorbeeld wanneer de mail gaat of dat hij nog uit staat. */
  when?: string;
  language: MailLanguage;
  subject: string;
  html: string;
};

export const MAIL_GROUPS: MailGroup[] = ["Klanten (webshops)", "Inloggen", "Affiliates", "Gratis kennis", "Intern"];

const APP = "https://support.sequenceflow.io";
const SITE = "https://www.sequenceflow.io";
const WORKSPACE_LANGUAGE = "Taal van de werkruimte (Instellingen → standaardtaal van de agent)";

function customerMails(language: MailLanguage): Array<Omit<MailPreview, "group" | "language" | "languageSource">> {
  const en = language === "en";
  const briefing = weeklyBriefingEmail({
    nl: !en, shopName: "Studio Lume",
    stats: { questions: 142, replies: 131, autonomous: 88, hours: 11, euros: 330, waiting: 4 },
    painPoints: en ? [
      { category: "Where is my parcel", count: 38, recommended_action: "Put the expected delivery time on the product page and in the confirmation email." },
      { category: "Registering a return", count: 17, recommended_action: "Link to the returns form at the bottom of every shipping email." },
      { category: "Size runs small", count: 9, recommended_action: "Add a size chart to the jackets." },
    ] : [
      { category: "Waar blijft mijn pakket", count: 38, recommended_action: "Zet de verwachte levertijd op de productpagina en in de bevestigingsmail." },
      { category: "Retour aanmelden", count: 17, recommended_action: "Link naar het retourformulier onderaan elke verzendmail." },
      { category: "Maat valt klein", count: 9, recommended_action: "Voeg een maattabel toe bij de jassen." },
    ],
    commerce: [],
    appUrl: APP,
    unsubscribeUrl: `${APP}/api/briefing/unsubscribe?voorbeeld=1${en ? "&lang=en" : ""}`,
  });
  const inventory = weeklyInventoryEmail({
    language, appUrl: APP, shopName: "Studio Lume", intro: null,
    summary: { deadVariants: 12, deadStockValue: 1840, lowVariants: 5, outOfStockVariants: 2, toOrderVariants: 6, toOrderUnits: 140 } as Parameters<typeof weeklyInventoryEmail>[0]["summary"],
    actions: (en ? [
      { title: "Order 60 Linen shirt, white, M", text: "Runs out in 9 days at the current pace; supplier lead time 14 days." },
      { title: "Put Wool scarf, grey on sale", text: "Nothing sold in 94 days, €420 tied up." },
    ] : [
      { title: "Bestel 60 stuks Linnen overhemd, wit, M", text: "Op in 9 dagen bij de huidige verkoop; levertijd leverancier 14 dagen." },
      { title: "Zet Wollen sjaal, grijs in de aanbieding", text: "Al 94 dagen niets verkocht, €420 vast." },
    ]) as Parameters<typeof weeklyInventoryEmail>[0]["actions"],
    questions: en ? [{ text: "Will the linen trousers come back in XL?" }, { text: "When is the white shirt available again?" }] : [{ text: "Komt de linnen broek in XL terug?" }, { text: "Wanneer is het overhemd in wit weer leverbaar?" }],
  });
  const alerts = alertEmail({ language, appUrl: APP, shopName: "Studio Lume", alerts: en ? [
    { title: "Linen shirt, white, M runs out in 5 days", body: "11 left; you sell just over 2 a day." },
    { title: "Canvas bag, sand is sold out", body: "Sold 18 times last week." },
  ] : [
    { title: "Linnen overhemd, wit, M is over 5 dagen op", body: "Nog 11 stuks; je verkoopt er ruim 2 per dag." },
    { title: "Canvas tas, zand is uitverkocht", body: "Vorige week 18 keer verkocht." },
  ] });
  const mailbox = mailboxAlertText({ language, address: "support@studiolume.nl", error: "AUTHENTICATIONFAILED", since: "2026-11-14T08:12:00Z", reconnectUrl: `${APP}/integrations?koppeling=mail`, shopify: false });
  const mailboxHtml = brandedFromText({ text: mailbox.text, language, eyebrow: en ? "Action needed · Support One" : "Actie nodig · Support One", title: mailbox.subject.replace(/^(Actie nodig|Action needed): /, ""), action: { label: en ? "Reconnect your mailbox" : "Mailbox opnieuw koppelen", href: `${APP}/integrations?koppeling=mail` } });
  const budget = budgetAlertEmail({ level: "near", used: "€118", budget: "€150", link: `${APP}/settings?tab=billing`, language });
  return [
    { key: "weekmail", name: "Seffy: weekmail", to: "Klant (beheerders)", when: "Elke maandag 07:00", subject: briefing.subject, html: briefing.html },
    { key: "inkoopadvies", name: "Otis: inkoopadvies", to: "Klant met Scale", when: "Wekelijks", subject: inventory.subject, html: inventory.html },
    { key: "voorraadmelding", name: "Otis: voorraadmelding", to: "Klant met Scale", when: "Als iets bijna op is", subject: alerts.subject, html: alerts.html },
    { key: "budget", name: "Milo: budget", to: "Klant (beheerders)", when: "Bij 80% en 100% van het maandbudget", subject: budget.subject, html: budget.html },
    { key: "mailbox", name: "Mailbox werkt niet", to: "Klant", when: "Als ophalen of versturen faalt", subject: mailbox.subject, html: mailboxHtml },
  ];
}

export function mailPreviews(): MailPreview[] {
  const previews: MailPreview[] = [];
  for (const language of ["nl", "en"] as const) {
    const en = language === "en";
    for (const mail of customerMails(language)) previews.push({ ...mail, group: "Klanten (webshops)", language, languageSource: WORKSPACE_LANGUAGE });

    const login = authEmail({ kind: "login", language, code: "482913", link: `${APP}/auth/confirm?token_hash=voorbeeld&type=email` });
    const invite = authEmail({ kind: "invite", language, link: `${APP}/auth/v1/verify?voorbeeld=1`, workspace: "Studio Lume" });
    const recovery = authEmail({ kind: "recovery", language, link: `${APP}/auth/v1/verify?voorbeeld=1` });
    previews.push(
      { key: "inlogcode", group: "Inloggen", name: "Inlogcode Support One", to: "Wie inlogt met e-mail", languageSource: "Taal van het inlogscherm (NL/EN-knop)", when: "Via de Supabase Send Email Hook", language, subject: login.subject, html: login.html },
      { key: "uitnodiging", group: "Inloggen", name: "Uitnodiging teamlid", to: "Nieuw teamlid", languageSource: WORKSPACE_LANGUAGE, when: "Via de Supabase Send Email Hook", language, subject: invite.subject, html: invite.html },
      { key: "wachtwoord", group: "Inloggen", name: "Nieuw wachtwoord", to: "Gebruiker", languageSource: "Opgeslagen taal van de gebruiker, anders Nederlands", when: "Alleen als iemand erom vraagt", language, subject: recovery.subject, html: recovery.html },
    );

    const welcome = affiliateWelcomeEmail({ name: "Juju de Vries", link: `${SITE}/r/ecomjuju`, code: "ecomjuju", dashboard: `${SITE}/affiliate/dashboard/voorbeeld`, holdDays: 60, language });
    const payout = affiliatePayoutEmail({ name: "Juju de Vries", amountCents: 7913, vatCents: 1662, totalCents: 9575, ibanMasked: "NL•• •••• •••• 4300", accountHolder: "J. de Vries", invoiceNumber: "SB-2026-0007", language });
    const affiliateSource = "Taal van de aanmeldpagina (/nl/affiliate of /en/affiliate)";
    previews.push(
      { key: "affiliate-welkom", group: "Affiliates", name: "Affiliate: welkom", to: "Nieuwe affiliate", languageSource: affiliateSource, when: "Direct na aanmelden", language, subject: welcome.subject, html: welcome.html },
      { key: "affiliate-uitbetaling", group: "Affiliates", name: "Affiliate: uitbetaald", to: "Affiliate", languageSource: affiliateSource, when: "Na elke uitbetaling", language, subject: payout.subject, html: payout.html },
    );

    const unsubscribe = `${SITE}/api/marketing/unsubscribe?l=voorbeeld&lang=${language}`;
    const download = leadDownloadEmail({ language, name: "Sanne", title: en ? "The Reply Bank" : "De Antwoordenbank", link: `${SITE}${en ? "/en/free/reply-bank" : "/nl/gratis/antwoordenbank"}?t=voorbeeld`, marketing: true, unsubscribeUrl: unsubscribe });
    const leadSource = "Taal van de downloadpagina (/nl/gratis of /en/free)";
    previews.push({ key: "gratis-download", group: "Gratis kennis", name: "Je download", to: "Wie een download ophaalt", languageSource: leadSource, when: "Direct na het formulier", language, subject: download.subject, html: download.html });
    NURTURE_DAYS.forEach((day, index) => {
      const mail = leadNurtureEmail({ step: index + 1, language, name: "Sanne", unsubscribeUrl: unsubscribe });
      previews.push({ key: `gratis-tip-${index + 1}`, group: "Gratis kennis", name: `Tip ${index + 1} (dag ${day})`, to: "Alleen met vinkje \"stuur me tips\"", languageSource: leadSource, when: `Dag ${day} na de download, pas als LEAD_NURTURE_ENABLED=1; met afmeldlink`, language, subject: mail.subject, html: mail.html });
    });
  }

  // Intern: altijd Nederlands, alleen voor het team.
  const backoffice = `${SITE}/backoffice`;
  const internal = "Altijd Nederlands (alleen voor het team)";
  const code = backofficeCodeEmail({ code: "482913" });
  const paidNotice = noticeEmail({ kind: "paid", ref: "voorbeeld", workspace: "Studio Lume", email: "eigenaar@studiolume.nl", plan: "Growth", amount: "€177,87 eerste maand, incl. btw", channel: "Stripe", source: "Affiliate ecomjuju" }, backoffice);
  const trialNotice = noticeEmail({ kind: "trial_ended", ref: "voorbeeld", workspace: "Petshop Pluis", email: "info@petshoppluis.nl", when: "17 november 2026", details: [{ label: "Antwoordconcepten in de proef", value: "3" }, { label: "Mailbox gekoppeld", value: "nee" }] }, backoffice);
  const resendNotice = noticeEmail({ kind: "resend_quota", ref: "voorbeeld", amount: "2.540 van 3.000 deze maand", reason: "85% van de maandlimiet is op. Bij dit tempo kom je deze maand op zo'n 3.400 mails, boven de limiet.", details: [{ label: "Laatste 24 uur", value: "91 van 100" }, { label: "Verwacht deze maand", value: "zo'n 3.400" }, { label: "Verstuurd / ontvangen", value: "1.610 / 930" }] }, backoffice);
  const creditNotice = noticeEmail({ kind: "openai_low", ref: "voorbeeld", amount: "$8,40", details: [{ label: "Laatste stand", value: "$50,00 op 10 november 2026" }, { label: "Verbruik per dag", value: "ongeveer $2,10" }, { label: "Nog genoeg voor", value: "zo'n 4 dagen" }] }, backoffice);
  for (const [key, name, to, subject, html] of [
    ["inlogcode-beheer", "Backoffice: inlogcode", "Beheerder", code.subject, code.html],
    ["melding-betaald", "Melding: betaald", "Beheerders", paidNotice.subject, paidNotice.html],
    ["melding-proef", "Melding: proef afgelopen", "Beheerders", trialNotice.subject, trialNotice.html],
    ["melding-resend", "Melding: Resend-limiet", "Beheerders", resendNotice.subject, resendNotice.html],
    ["melding-openai", "Melding: OpenAI-tegoed", "Beheerders", creditNotice.subject, creditNotice.html],
  ] as const) previews.push({ key, group: "Intern", name, to, languageSource: internal, language: "nl", subject, html });
  return previews;
}
