/**
 * Meldingen aan de beheerders van SequenceFlow: wie zich aanmeldt, betaalt, opzegt of na
 * de proef afhaakt, en wanneer het OpenAI-tegoed opraakt. Tekst en opmaak, zonder database
 * of imports met een alias, zodat het los te testen is.
 */

import { renderBrandedEmail, type MailBlock } from "../email/branded.ts";

export type NoticeKind =
  | "signup" | "paid" | "cancel_scheduled" | "canceled" | "payment_failed"
  | "trial_ended" | "shopify_uninstalled" | "openai_low" | "silence" | "resend_quota";

export type Notice = {
  kind: NoticeKind;
  /** Uniek per gebeurtenis; dezelfde kind + ref wordt maar één keer gemaild. */
  ref: string;
  tenantId?: string | null;
  workspace?: string | null;
  email?: string | null;
  plan?: string | null;
  /** Bijvoorbeeld "Google", "Shopify-app", "Stripe". */
  channel?: string | null;
  amount?: string | null;
  when?: string | null;
  reason?: string | null;
  source?: string | null;
  details?: Array<{ label: string; value: string }>;
};

const TITLES: Record<NoticeKind, { eyebrow: string; title: (n: Notice) => string; subject: (n: Notice) => string; intro: string }> = {
  signup: { eyebrow: "Nieuwe aanmelding", title: (n) => n.workspace || "Nieuwe werkruimte", subject: (n) => `Nieuwe aanmelding: ${n.workspace || n.email || "werkruimte"}`, intro: "Er is een nieuwe werkruimte aangemaakt. De proef van 14 dagen loopt vanaf nu." },
  paid: { eyebrow: "Nieuwe betalende klant", title: (n) => `${n.workspace || "Klant"} betaalt`, subject: (n) => `Betaald: ${n.workspace || n.email || "klant"}${n.plan ? ` · ${n.plan}` : ""}${n.amount ? ` · ${n.amount}` : ""}`, intro: "Een werkruimte heeft een betaald abonnement afgesloten." },
  cancel_scheduled: { eyebrow: "Opgezegd", title: (n) => `${n.workspace || "Klant"} zegt op`, subject: (n) => `Opgezegd: ${n.workspace || n.email || "klant"}${n.when ? `, loopt af op ${n.when}` : ""}`, intro: "Een betalende klant heeft opgezegd. Het abonnement loopt nog tot het einde van de periode: er is nog tijd om contact op te nemen." },
  canceled: { eyebrow: "Abonnement beëindigd", title: (n) => `${n.workspace || "Klant"} is gestopt`, subject: (n) => `Gestopt: ${n.workspace || n.email || "klant"}`, intro: "Het abonnement van deze klant is beëindigd." },
  payment_failed: { eyebrow: "Betaling mislukt", title: (n) => `${n.workspace || "Klant"}: betaling mislukt`, subject: (n) => `Betaling definitief mislukt: ${n.workspace || n.email || "klant"}`, intro: "Stripe kon na alle pogingen niet incasseren. De werkruimte staat nu op verlopen." },
  trial_ended: { eyebrow: "Proef afgelopen", title: (n) => `${n.workspace || "Werkruimte"}: proef voorbij, niet betaald`, subject: (n) => `Proef afgelopen zonder betaling: ${n.workspace || n.email || "werkruimte"}`, intro: "De proef van 14 dagen is voorbij en er is geen abonnement afgesloten. Een persoonlijk mailtje werkt nu het best." },
  shopify_uninstalled: { eyebrow: "Shopify-app verwijderd", title: (n) => `${n.workspace || "Winkel"} heeft de app verwijderd`, subject: (n) => `Shopify-app verwijderd: ${n.workspace || "winkel"}`, intro: "Een winkel heeft Support One uit Shopify verwijderd. Een abonnement via Shopify stopt daarmee ook." },
  silence: { eyebrow: "Stilte", title: (n) => n.reason || "Er blijft iets uit", subject: (n) => `Stilte: ${n.reason || "er blijft iets uit"}${n.workspace ? ` (${n.workspace})` : ""}`, intro: "Iets dat regelmatig hoort te gebeuren, is uitgebleven. Deze mail komt elke dag terug tot het is opgelost (zie /intern)." },
  resend_quota: { eyebrow: "Resend-mails", title: () => "Tijd om Resend te upgraden", subject: (n) => `Resend: ${n.amount ?? "limiet in zicht"}`, intro: "Het verbruik bij Resend komt bij de limiet. Daarboven weigert Resend mails: inlogcodes, meldingen, weekmails en doorgestuurde klantmails. Geweigerde mails worden niet later alsnog verstuurd." },
  openai_low: { eyebrow: "OpenAI-tegoed", title: () => "Het OpenAI-tegoed raakt op", subject: (n) => `OpenAI-tegoed bijna op${n.amount ? `: nog ${n.amount}` : ""}`, intro: "Zonder tegoed stoppen Seffy, Otis en Milo met antwoorden. Vul het tegoed aan op platform.openai.com en zet de nieuwe stand in de backoffice." },
};

export function noticeEmail(notice: Notice, backofficeUrl: string) {
  const t = TITLES[notice.kind];
  const rows = [
    notice.workspace ? { label: "Werkruimte", value: notice.workspace } : null,
    notice.email ? { label: "E-mail", value: notice.email } : null,
    notice.plan ? { label: "Pakket", value: notice.plan } : null,
    notice.amount ? { label: notice.kind === "openai_low" ? "Geschat over" : notice.kind === "resend_quota" ? "Stand" : "Bedrag", value: notice.amount } : null,
    notice.channel ? { label: "Via", value: notice.channel } : null,
    notice.source ? { label: "Herkomst", value: notice.source } : null,
    notice.when ? { label: notice.kind === "cancel_scheduled" ? "Loopt af op" : "Wanneer", value: notice.when } : null,
    notice.reason ? { label: "Reden", value: notice.reason } : null,
    ...(notice.details ?? []),
  ].filter((row): row is { label: string; value: string } => Boolean(row));
  const target = notice.kind === "openai_low" || notice.kind === "silence" || notice.kind === "resend_quota" ? `${backofficeUrl}?tab=overzicht` : `${backofficeUrl}?tab=klanten`;
  const blocks: MailBlock[] = [
    { type: "paragraph", text: t.intro },
    ...(rows.length ? [{ type: "rows" as const, items: rows }] : []),
    { type: "button", label: notice.kind === "openai_low" ? "Tegoed bijwerken" : notice.kind === "resend_quota" ? "Bekijk het verbruik" : "Bekijk in de backoffice", href: target },
  ];
  const text = [t.intro, "", ...rows.map((row) => `${row.label}: ${row.value}`), "", `Backoffice: ${target}`].join("\n");
  const html = renderBrandedEmail({ eyebrow: t.eyebrow, title: t.title(notice), blocks, footer: ["Je krijgt deze mail omdat je beheerder bent van SequenceFlow (PLATFORM_ADMIN_EMAILS)."] });
  return { subject: t.subject(notice), text, html };
}

/** Wie de meldingen krijgt: BACKOFFICE_NOTIFY_EMAILS als die is ingesteld, anders alle beheerders. */
export function noticeRecipients(env: Record<string, string | undefined>) {
  const list = env.BACKOFFICE_NOTIFY_EMAILS?.trim() || env.PLATFORM_ADMIN_EMAILS || "";
  return [...new Set(list.split(",").map((item) => item.trim().toLowerCase()).filter((item) => item.includes("@")))];
}

/** Melding over een Stripe-opzegging uit een customer.subscription.updated-event; null als er niets nieuws is opgezegd. */
export function scheduledCancel(subscription: { cancel_at_period_end?: boolean | null; cancel_at?: number | null }, previous: Record<string, unknown> | null | undefined) {
  if (!previous) return null;
  const nowScheduled = Boolean(subscription.cancel_at_period_end) || Boolean(subscription.cancel_at);
  const wasScheduled = ("cancel_at_period_end" in previous ? Boolean(previous.cancel_at_period_end) : Boolean(subscription.cancel_at_period_end))
    || ("cancel_at" in previous ? Boolean(previous.cancel_at) : Boolean(subscription.cancel_at));
  if (!nowScheduled || wasScheduled) return null;
  return { endsAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null };
}
