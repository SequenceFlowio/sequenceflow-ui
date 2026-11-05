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
  starter: { nl: ["Antwoordconcepten ter beoordeling"], en: ["Reply drafts for review"] },
  pro: { nl: ["Automatisch versturen (optioneel)", "Inzicht, klantpijnpunten en Milo"], en: ["Automatic sending (optional)", "Insights, customer pain points and Milo"] },
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
  plan("starter", "starter", "Starter", 79, false, { nl: "Voor webshops tot zo'n 50 bestellingen per dag", en: "For stores up to about 50 orders a day" }),
  plan("pro", "growth", "Growth", 229, true, { nl: "Voor groeiende webshops", en: "For growing stores" }),
  plan("agency", "scale", "Scale", 549, false, { nl: "Voor grote webshops en hoge volumes", en: "For large stores and high volumes" }),
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

/**
 * Staat pas aan als het factureren per afhandeling ook live werkt
 * (NEXT_PUBLIC_PRICING_V2=on, samen met STRIPE_USAGE_BILLING=on).
 * Tot die tijd laat de site de huidige prijzen zien.
 */
export const PRICING_V2_ON = process.env.NEXT_PUBLIC_PRICING_V2 === "on";

/** Per afgehandeld gesprek, in centen; gelijk aan HANDLED_PRICING in lib/billing/handledConversations.ts. */
export const HANDLED_RATES = { assisted: 49, autonomous: 99 } as const;

export const PLAN_CATALOG_V2: Array<{
  id: PaidPlanId;
  slug: "starter" | "growth" | "scale";
  name: string;
  baseCents: number;
  recommended: boolean;
  /** Voor wie, in één zin. */
  audience: string;
  autonomous: boolean;
  features: string[];
}> = [
  {
    id: "starter", slug: "starter", name: "Starter", baseCents: 4900, recommended: false, autonomous: false,
    audience: "Je wilt sneller antwoorden en alles zelf controleren.",
    features: ["AI-antwoordvoorstellen in je eigen stijl", "Jij keurt elk antwoord goed", "1 supportmailbox", "2 teamleden", "25 kennisdocumenten"],
  },
  {
    id: "pro", slug: "growth", name: "Growth", baseCents: 14900, recommended: true, autonomous: true,
    audience: "Je wilt geschikte klantvragen automatisch laten afhandelen.",
    features: ["Alles uit Starter", "Automatisch versturen, met jouw regels", "Inzicht in terugkerende vragen en knelpunten", "Milo als je vaste aanspreekpunt", "5 teamleden, 100 kennisdocumenten"],
  },
  {
    id: "agency", slug: "scale", name: "Scale", baseCents: 29900, recommended: false, autonomous: true,
    audience: "Je wilt daarnaast grip op voorraad en een groter team.",
    features: ["Alles uit Growth", ...(INVENTORY_LIVE ? ["Voorraad- en inkoopadvies met Otis"] : []), "Onbeperkt teamleden en kennisdocumenten", "Prioriteitsondersteuning"],
  },
];

/** €0,49 */
export function formatCents(cents: number) {
  const euros = cents / 100;
  return `€${euros.toLocaleString("nl-NL", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Maandbedrag = vast + gecontroleerd × €0,49 + zelfstandig × €0,99, plus de prijs per afgehandeld gesprek. */
export function monthlyEstimate(baseCents: number, assisted: number, autonomous: number) {
  const totalCents = baseCents + assisted * HANDLED_RATES.assisted + autonomous * HANDLED_RATES.autonomous;
  const handled = assisted + autonomous;
  return { totalCents, perHandledCents: handled ? Math.round(totalCents / handled) : null };
}
