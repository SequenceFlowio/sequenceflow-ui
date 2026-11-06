import { PLAN_LIMITS, type Plan } from "./billingPlans.ts";

/**
 * De ene prijslijst van Support One. Prijspagina, app, upgrade-scherm,
 * site-chat, llms.txt, affiliaterekenvoorbeeld en de server lezen hier hun
 * bedragen en volumes uit. De volumes komen uit PLAN_LIMITS, zodat wat we
 * beloven en wat de server toestaat nooit uit elkaar lopen.
 *
 * Een prijswijziging gebeurt hier (en in Stripe), nergens anders.
 */

/** Inkoopadvies hoort bij Scale, maar staat pas in de lijst zodra de functie aan staat. */
const INVENTORY_LIVE = process.env.NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED === "true";

/**
 * Staat pas aan als het factureren per afhandeling ook live werkt
 * (NEXT_PUBLIC_PRICING_V2=on, samen met STRIPE_USAGE_BILLING=on).
 * Tot die tijd laat de site de huidige prijzen zien.
 */
export const PRICING_V2_ON = process.env.NEXT_PUBLIC_PRICING_V2 === "on";

export type PaidPlanId = Extract<Plan, "starter" | "pro" | "agency">;
type Language = "nl" | "en";

type CatalogPlan = {
  id: PaidPlanId;
  /** Zoals in publieke links (/login?plan=growth); de ids blijven starter/pro/agency voor Stripe en bestaande accounts. */
  slug: "starter" | "growth" | "scale";
  name: string;
  /** Euro per maand, zoals op de prijspagina. */
  price: number;
  recommended: boolean;
  description: { nl: string; en: string };
  features: { nl: string[]; en: string[] };
};

const EXTRAS: Record<PaidPlanId, { nl: string[]; en: string[] }> = {
  starter: PRICING_V2_ON
    ? { nl: ["Automatisch versturen (optioneel)", "Analytics"], en: ["Automatic sending (optional)", "Analytics"] }
    : { nl: ["Antwoordconcepten ter beoordeling", "Analytics"], en: ["Reply drafts for review", "Analytics"] },
  pro: { nl: ["Automatisch versturen (optioneel)", "Pijnpunten met AI-advies"], en: ["Automatic sending (optional)", "Pain points with AI advice"] },
  agency: {
    nl: ["Automatisch versturen en inplannen", ...(INVENTORY_LIVE ? ["Voorraad- en inkoopadvies"] : []), "Prioriteitsondersteuning"],
    en: ["Automatic sending and scheduling", ...(INVENTORY_LIVE ? ["Stock and buying advice"] : []), "Priority support"],
  },
};

/** 1500 → "1.500" (nl) of "1,500" (en). */
export function formatCount(value: number, language: Language = "nl") {
  return value.toLocaleString(language === "nl" ? "nl-NL" : "en-US");
}

/** De vaste regels van een pakket (concepten, mailbox, team, kennis), uit dezelfde limieten die de server afdwingt. */
export function limitFeatures(plan: Plan, language: Language = "nl") {
  const limits = PLAN_LIMITS[plan];
  const nl = language === "nl";
  const amount = (value: number, one: string, many: string) =>
    Number.isFinite(value) ? `${formatCount(value, language)} ${value === 1 ? one : many}` : `${nl ? "Onbeperkt" : "Unlimited"} ${many}`;
  return [
    `${formatCount(limits.aiAnswers, language)} ${nl ? "antwoordconcepten per maand" : "reply drafts per month"}`,
    amount(limits.inboxes, nl ? "supportmailbox" : "support mailbox", nl ? "supportmailboxen" : "support mailboxes"),
    amount(limits.members, nl ? "teamlid" : "team member", nl ? "teamleden" : "team members"),
    amount(limits.docs, nl ? "kennisdocument" : "knowledge document", nl ? "kennisdocumenten" : "knowledge documents"),
  ];
}

function plan(id: PaidPlanId, slug: CatalogPlan["slug"], name: string, price: number, recommended: boolean, description: CatalogPlan["description"]): CatalogPlan {
  return {
    id, slug, name, price, recommended, description,
    features: {
      nl: [...limitFeatures(id, "nl"), ...EXTRAS[id].nl],
      en: [...limitFeatures(id, "en"), ...EXTRAS[id].en],
    },
  };
}

export const PAID_PLAN_CATALOG: CatalogPlan[] = [
  plan("starter", "starter", "Starter", PRICING_V2_ON ? 49 : 79, false, { nl: "Voor webshops tot zo'n 50 bestellingen per dag", en: "For stores up to about 50 orders a day" }),
  plan("pro", "growth", "Growth", PRICING_V2_ON ? 149 : 229, true, { nl: "Voor groeiende webshops", en: "For growing stores" }),
  plan("agency", "scale", "Scale", PRICING_V2_ON ? 299 : 549, false, { nl: "Voor grote webshops en hoge volumes", en: "For large stores and high volumes" }),
];

export function catalogPlan(id: PaidPlanId) {
  return PAID_PLAN_CATALOG.find((item) => item.id === id)!;
}

/** €79 */
export function formatPlanPrice(price: number) {
  return `€${formatCount(price)}`;
}

/** "Starter €79, Growth €229 en Scale €549" */
export function planPriceSummary(language: Language = "nl") {
  const parts = PAID_PLAN_CATALOG.map((item) => `${item.name} ${formatPlanPrice(item.price)}`);
  return `${parts.slice(0, -1).join(", ")} ${language === "nl" ? "en" : "and"} ${parts.at(-1)}`;
}

/** Laagste maandprijs, voor "begint bij €79". */
export const LOWEST_PLAN_PRICE = Math.min(...PAID_PLAN_CATALOG.map((item) => item.price));

export function isPaidPlan(plan: string): plan is PaidPlanId | "custom" {
  return ["starter", "pro", "agency", "custom"].includes(plan);
}

/**
 * De naam die klanten zien. Intern blijven de ids starter/pro/agency
 * (Stripe-koppelingen en bestaande accounts); in beeld heten ze Starter,
 * Growth en Scale.
 */
export function planDisplayName(plan: string | null | undefined, language: "nl" | "en" = "nl") {
  if (!plan) return "—";
  if (plan === "trial") return language === "nl" ? "Proef" : "Trial";
  if (plan === "expired") return language === "nl" ? "Verlopen" : "Expired";
  if (plan === "custom") return language === "nl" ? "Maatwerk" : "Custom";
  return PAID_PLAN_CATALOG.find((item) => item.id === plan)?.name ?? plan.charAt(0).toUpperCase() + plan.slice(1);
}

/* ------------------------------------------------------------------ */
/* Nieuwe prijzen (november 2026): vast bedrag + betalen per afhandeling */
/* ------------------------------------------------------------------ */


/** Per afgehandeld gesprek, in centen; gelijk aan HANDLED_PRICING in lib/billing/handledConversations.ts. */
export const HANDLED_RATES = { assisted: 49, autonomous: 99 } as const;

/** Een regel op een prijskaart: een functie met naam (in het merkgroen) of een gewone regel. */
export type PlanFeature = { name?: string; text: string };

export const PLAN_CATALOG_V2: Array<{
  id: PaidPlanId;
  slug: "starter" | "growth" | "scale";
  name: string;
  baseCents: number;
  recommended: boolean;
  /** Voor wie, in één zin. */
  audience: string;
  /** Afgehandelde gesprekken per maand die bij het vaste bedrag horen. */
  included: number;
  /** Antwoordconcepten per maand. */
  drafts: number;
  /** "Alles uit Starter, plus:" */
  includes?: string;
  features: PlanFeature[];
}> = [
  {
    id: "starter", slug: "starter", name: "Starter", baseCents: 4900, recommended: false, included: 100, drafts: 500,
    audience: "Voor een kleine winkel die sneller wil antwoorden.",
    features: [
      { name: "Antwoordvoorstellen", text: "in je eigen stijl, jij keurt goed of past aan" },
      { name: "Automatisch versturen", text: "geschikte vragen gaan vanzelf de deur uit, met jouw regels en verzendmomenten" },
      { name: "Analytics", text: "hoeveel vragen er binnenkomen, waarover en wanneer" },
      { name: "Milo", text: "je vaste aanspreekpunt in de app" },
      { text: "1 supportmailbox, 2 teamleden, 25 kennisdocumenten" },
    ],
  },
  {
    id: "pro", slug: "growth", name: "Growth", baseCents: 14900, recommended: true, included: 400, drafts: 2000,
    audience: "Voor een winkel met dagelijks een stroom klantvragen.",
    includes: "Alles uit Starter, plus:",
    features: [
      { name: "Pijnpunten", text: "waar klanten op vastlopen, met AI-advies over wat je kunt verbeteren" },
      { text: "5 teamleden, 100 kennisdocumenten" },
    ],
  },
  {
    id: "agency", slug: "scale", name: "Scale", baseCents: 29900, recommended: false, included: 1000, drafts: 6000,
    audience: "Voor grote volumes, en je voorraad onder controle.",
    includes: "Alles uit Growth, plus:",
    features: [
      { name: "Voorraad met Otis", text: "ziet wat opraakt voordat je misgrijpt" },
      { name: "Inkoopadvies", text: "wat en hoeveel je bijbestelt, met een concept-inkooporder die jij goedkeurt" },
      { name: "Onbeperkt team", text: "onbeperkt teamleden en kennisdocumenten" },
      { name: "Prioriteit", text: "je vragen aan ons gaan voor" },
    ],
  },
];

/** €0,49 */
export function formatCents(cents: number) {
  const euros = cents / 100;
  return `€${euros.toLocaleString("nl-NL", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/**
 * Maandbedrag = vast bedrag + (afgehandelde gesprekken boven het inbegrepen
 * aantal) × tarief. Het inbegrepen deel wordt naar verhouding over
 * gecontroleerd en zelfstandig verdeeld; de echte factuur telt op volgorde.
 */
export function monthlyEstimate(baseCents: number, assisted: number, autonomous: number, included = 0) {
  const handled = assisted + autonomous;
  const extra = Math.max(0, handled - included);
  const share = handled ? extra / handled : 0;
  const usageCents = Math.round(share * (assisted * HANDLED_RATES.assisted + autonomous * HANDLED_RATES.autonomous));
  const totalCents = baseCents + usageCents;
  return { totalCents, usageCents, extra, perHandledCents: handled ? Math.round(totalCents / handled) : null };
}

/** Het goedkoopste pakket voor dit aantal gesprekken. */
export function cheapestPlan(assisted: number, autonomous: number) {
  return PLAN_CATALOG_V2
    .map((plan) => ({ plan, ...monthlyEstimate(plan.baseCents, assisted, autonomous, plan.included) }))
    .sort((a, b) => a.totalCents - b.totalCents)[0];
}
