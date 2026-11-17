/**
 * Voorbeelden van elke mail in huisstijl, met verzonnen gegevens. Voor het
 * tabblad Mails in de backoffice en voor de tests. Zonder imports met een alias.
 */

import { alertEmail } from "../inventory/alertsCore.ts";
import { weeklyInventoryEmail } from "../inventory/emailCore.ts";
import { weeklyBriefingEmail } from "../support/weeklyBriefing.ts";
import { brandedFromText } from "./branded.ts";
import { mailboxAlertText } from "./mailboxAlertText.ts";
import { noticeEmail } from "../backoffice/notifyCore.ts";
import { affiliatePayoutEmail, affiliateWelcomeEmail, backofficeCodeEmail } from "./templates.ts";

export type MailPreview = { key: string; name: string; to: string; subject: string; html: string };

const APP = "https://support.sequenceflow.io";

export function mailPreviews(): MailPreview[] {
  const welcome = affiliateWelcomeEmail({ name: "Juju de Vries", link: "https://www.sequenceflow.io/r/ecomjuju", code: "ecomjuju", dashboard: "https://www.sequenceflow.io/affiliate/dashboard/voorbeeld", holdDays: 60 });
  const payout = affiliatePayoutEmail({ name: "Juju de Vries", amountCents: 7913, vatCents: 1662, totalCents: 9575, ibanMasked: "NL•• •••• •••• 4300", accountHolder: "J. de Vries", invoiceNumber: "SB-2026-0007" });
  const code = backofficeCodeEmail({ code: "482913" });
  const briefing = weeklyBriefingEmail({
    nl: true, shopName: "Studio Lume",
    stats: { questions: 142, replies: 131, autonomous: 88, hours: 11, euros: 330, waiting: 4 },
    painPoints: [
      { category: "Waar blijft mijn pakket", count: 38, recommended_action: "Zet de verwachte levertijd op de productpagina en in de bevestigingsmail." },
      { category: "Retour aanmelden", count: 17, recommended_action: "Link naar het retourformulier onderaan elke verzendmail." },
      { category: "Maat valt klein", count: 9, recommended_action: "Voeg een maattabel toe bij de jassen." },
    ],
    commerce: [],
    appUrl: APP,
    unsubscribeUrl: `${APP}/api/briefing/unsubscribe?voorbeeld=1`,
  });
  const inventory = weeklyInventoryEmail({
    language: "nl", appUrl: APP, shopName: "Studio Lume", intro: null,
    summary: { deadVariants: 12, deadStockValue: 1840, lowVariants: 5, outOfStockVariants: 2, toOrderVariants: 6, toOrderUnits: 140 } as Parameters<typeof weeklyInventoryEmail>[0]["summary"],
    actions: [
      { title: "Bestel 60 stuks Linnen overhemd, wit, M", text: "Op in 9 dagen bij de huidige verkoop; levertijd leverancier 14 dagen." },
      { title: "Zet Wollen sjaal, grijs in de aanbieding", text: "Al 94 dagen niets verkocht, €420 vast." },
    ] as Parameters<typeof weeklyInventoryEmail>[0]["actions"],
    questions: [{ text: "Komt de linnen broek in XL terug?" }, { text: "Wanneer is het overhemd in wit weer leverbaar?" }],
  });
  const alerts = alertEmail({ language: "nl", appUrl: APP, shopName: "Studio Lume", alerts: [
    { title: "Linnen overhemd, wit, M is over 5 dagen op", body: "Nog 11 stuks; je verkoopt er ruim 2 per dag." },
    { title: "Canvas tas, zand is uitverkocht", body: "Vorige week 18 keer verkocht." },
  ] });
  const mailbox = mailboxAlertText({ language: "nl", address: "support@studiolume.nl", error: "AUTHENTICATIONFAILED", since: "2026-11-14T08:12:00Z", reconnectUrl: `${APP}/integrations?koppeling=mail`, shopify: false });
  const mailboxHtml = brandedFromText({ text: mailbox.text, language: "nl", eyebrow: "Actie nodig · Support One", title: mailbox.subject.replace(/^Actie nodig: /, ""), action: { label: "Mailbox opnieuw koppelen", href: `${APP}/integrations?koppeling=mail` } });
  const budgetText = `Hoi,\n\nDeze maand is er voor €118 aan afgehandelde gesprekken geteld. Je budget is €150.\n\nBoven je budget betaal je niets en Support One blijft gewoon werken. Wil je het budget aanpassen? Dat kan hier: ${APP}/settings?tab=billing\n\nGroet,\nMilo van SequenceFlow`;
  const budgetHtml = brandedFromText({ text: budgetText, language: "nl", eyebrow: "Milo · je budget", title: "80% van je maandbudget", action: { label: "Budget bekijken", href: `${APP}/settings?tab=billing` } });

  const backoffice = "https://www.sequenceflow.io/backoffice";
  const paidNotice = noticeEmail({ kind: "paid", ref: "voorbeeld", workspace: "Studio Lume", email: "eigenaar@studiolume.nl", plan: "Growth", amount: "€177,87 eerste maand, incl. btw", channel: "Stripe", source: "Affiliate ecomjuju" }, backoffice);
  const trialNotice = noticeEmail({ kind: "trial_ended", ref: "voorbeeld", workspace: "Petshop Pluis", email: "info@petshoppluis.nl", when: "17 november 2026", details: [{ label: "Antwoordconcepten in de proef", value: "3" }, { label: "Mailbox gekoppeld", value: "nee" }] }, backoffice);
  const creditNotice = noticeEmail({ kind: "openai_low", ref: "voorbeeld", amount: "$8,40", details: [{ label: "Laatste stand", value: "$50,00 op 10 november 2026" }, { label: "Verbruik per dag", value: "ongeveer $2,10" }, { label: "Nog genoeg voor", value: "zo'n 4 dagen" }] }, backoffice);

  return [
    { key: "affiliate-welkom", name: "Affiliate: welkom", to: "Nieuwe affiliate", subject: welcome.subject, html: welcome.html },
    { key: "affiliate-uitbetaling", name: "Affiliate: uitbetaald", to: "Affiliate", subject: payout.subject, html: payout.html },
    { key: "weekmail", name: "Seffy: weekmail", to: "Klant (beheerders)", subject: briefing.subject, html: briefing.html },
    { key: "inkoopadvies", name: "Otis: inkoopadvies", to: "Klant met Scale", subject: inventory.subject, html: inventory.html },
    { key: "voorraadmelding", name: "Otis: voorraadmelding", to: "Klant met Scale", subject: alerts.subject, html: alerts.html },
    { key: "budget", name: "Milo: budget", to: "Klant (beheerders)", subject: "Je zit op 80% van je maandbudget (€118 van €150)", html: budgetHtml },
    { key: "mailbox", name: "Mailbox werkt niet", to: "Klant", subject: mailbox.subject, html: mailboxHtml },
    { key: "inlogcode", name: "Backoffice: inlogcode", to: "Beheerder", subject: code.subject, html: code.html },
    { key: "melding-betaald", name: "Melding: betaald", to: "Beheerders", subject: paidNotice.subject, html: paidNotice.html },
    { key: "melding-proef", name: "Melding: proef afgelopen", to: "Beheerders", subject: trialNotice.subject, html: trialNotice.html },
    { key: "melding-openai", name: "Melding: OpenAI-tegoed", to: "Beheerders", subject: creditNotice.subject, html: creditNotice.html },
  ];
}
