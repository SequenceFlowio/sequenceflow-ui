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

/** Afgehandelde gesprekken per maand bij het vaste bedrag (gelijk aan HANDLED_PRICING.includedPerPeriod; een test bewaakt dat). */
export const INCLUDED_HANDLED: Record<PaidPlanId, number> = { starter: 100, pro: 400, agency: 1000 };

/** Wat een pakketkaart bij de nieuwe prijzen noemt, in de app en op de site hetzelfde. */
function v2Card(id: PaidPlanId, language: Language) {
  const nl = language === "nl";
  const count = (value: number) => formatCount(value, language);
  const head = [
    nl ? `${count(INCLUDED_HANDLED[id])} afgehandelde gesprekken inbegrepen` : `${count(INCLUDED_HANDLED[id])} handled conversations included`,
    nl ? "Daarboven €0,47 (jij controleert) of €0,97 (AI zelfstandig) per gesprek" : "Above that €0.47 (you check) or €0.97 (AI on its own) per conversation",
    nl ? `${count(PLAN_LIMITS[id].aiAnswers)} antwoordconcepten per maand` : `${count(PLAN_LIMITS[id].aiAnswers)} reply drafts per month`,
  ];
  const rest: Record<PaidPlanId, [string, string][]> = {
    starter: [
      ["Automatisch versturen en inplannen", "Automatic sending and scheduling"],
      ["Analytics", "Analytics"],
      ["Milo, je vaste aanspreekpunt in de app", "Milo, your go-to assistant in the app"],
      ["1 supportmailbox, 2 teamleden, 25 kennisdocumenten", "1 support mailbox, 2 team members, 25 knowledge documents"],
    ],
    pro: [
      ["Alles uit Starter", "Everything in Starter"],
      ["Pijnpunten met AI-advies", "Pain points with AI advice"],
      ["Weekoverzicht met beschikbare pijnpunten per mail", "Weekly email with available pain points"],
      ["5 teamleden, 100 kennisdocumenten", "5 team members, 100 knowledge documents"],
    ],
    agency: [
      ["Alles uit Growth", "Everything in Growth"],
      ["Voorraad met Otis en inkoopadvies", "Stock with Otis and buying advice"],
      ["Onbeperkt teamleden en kennisdocumenten", "Unlimited team members and knowledge documents"],
      ["Prioriteitsondersteuning", "Priority support"],
    ],
  };
  return [...head, ...rest[id].map(([nlText, enText]) => (nl ? nlText : enText))];
}

const V2_DESCRIPTION: Record<PaidPlanId, { nl: string; en: string }> = {
  starter: { nl: "Voor een kleine winkel die sneller wil antwoorden.", en: "For a small store that wants to reply faster." },
  pro: { nl: "Voor een winkel met dagelijks een stroom klantvragen.", en: "For a store with a daily stream of customer questions." },
  agency: { nl: "Voor grote volumes, en je voorraad onder controle.", en: "For high volumes, with your stock under control." },
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
  if (PRICING_V2_ON) {
    return { id, slug, name, price, recommended, description: V2_DESCRIPTION[id], features: { nl: v2Card(id, "nl"), en: v2Card(id, "en") } };
  }
  return {
    id, slug, name, price, recommended, description,
    features: {
      nl: [...limitFeatures(id, "nl"), ...EXTRAS[id].nl],
      en: [...limitFeatures(id, "en"), ...EXTRAS[id].en],
    },
  };
}

export const PAID_PLAN_CATALOG: CatalogPlan[] = [
  plan("starter", "starter", "Starter", PRICING_V2_ON ? 47 : 79, false, { nl: "Voor webshops tot zo'n 50 bestellingen per dag", en: "For stores up to about 50 orders a day" }),
  plan("pro", "growth", "Growth", PRICING_V2_ON ? 147 : 229, true, { nl: "Voor groeiende webshops", en: "For growing stores" }),
  plan("agency", "scale", "Scale", PRICING_V2_ON ? 297 : 549, false, { nl: "Voor grote webshops en hoge volumes", en: "For large stores and high volumes" }),
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
export const HANDLED_RATES = { assisted: 47, autonomous: 97 } as const;

/** Een regel op een prijskaart: een functie met naam (in het merkgroen) of een gewone regel. */
export type PlanFeature = { name?: string; text: string; nameEn?: string; textEn?: string };

export const PLAN_CATALOG_V2: Array<{
  id: PaidPlanId;
  slug: "starter" | "growth" | "scale";
  name: string;
  baseCents: number;
  recommended: boolean;
  /** Voor wie, in één zin. */
  audience: string;
  audienceEn: string;
  /** Afgehandelde gesprekken per maand die bij het vaste bedrag horen. */
  included: number;
  /** Antwoordconcepten per maand. */
  drafts: number;
  /** "Alles uit Starter, plus:" */
  includes?: string;
  includesEn?: string;
  features: PlanFeature[];
}> = [
  {
    id: "starter", slug: "starter", name: "Starter", baseCents: 4700, recommended: false, included: INCLUDED_HANDLED.starter, drafts: 500,
    audience: "Voor een kleine winkel die sneller wil antwoorden.",
    audienceEn: "For a small store that wants to reply faster.",
    features: [
      { name: "Antwoordvoorstellen", text: "in je eigen stijl, jij keurt goed of past aan", nameEn: "Reply drafts", textEn: "in your own style, you approve or edit" },
      { name: "Automatisch versturen", text: "geschikte vragen gaan vanzelf de deur uit, met jouw regels en verzendmomenten", nameEn: "Automatic sending", textEn: "suitable questions go out on their own, with your rules and send times" },
      { name: "Analytics", text: "hoeveel vragen er binnenkomen, waarover en wanneer", nameEn: "Analytics", textEn: "how many questions come in, about what and when" },
      { name: "Milo", text: "je vaste aanspreekpunt in de app", nameEn: "Milo", textEn: "your go-to assistant in the app" },
      { text: "1 supportmailbox, 2 teamleden, 25 kennisdocumenten", textEn: "1 support mailbox, 2 team members, 25 knowledge documents" },
    ],
  },
  {
    id: "pro", slug: "growth", name: "Growth", baseCents: 14700, recommended: true, included: INCLUDED_HANDLED.pro, drafts: 2000,
    audience: "Voor een winkel met dagelijks een stroom klantvragen.",
    audienceEn: "For a store with a daily stream of customer questions.",
    includes: "Alles uit Starter, plus:",
    includesEn: "Everything in Starter, plus:",
    features: [
      { name: "Pijnpunten", text: "waar klanten op vastlopen, met AI-advies over wat je kunt verbeteren", nameEn: "Pain points", textEn: "where customers get stuck, with AI advice on what to improve" },
      { name: "Weekoverzicht", text: "ontvang je activiteit en beschikbare pijnpunten per mail", nameEn: "Weekly summary", textEn: "receive your activity and available pain points by email" },
      { text: "5 teamleden, 100 kennisdocumenten", textEn: "5 team members, 100 knowledge documents" },
    ],
  },
  {
    id: "agency", slug: "scale", name: "Scale", baseCents: 29700, recommended: false, included: INCLUDED_HANDLED.agency, drafts: 6000,
    audience: "Voor grote volumes, en je voorraad onder controle.",
    audienceEn: "For high volumes, with your stock under control.",
    includes: "Alles uit Growth, plus:",
    includesEn: "Everything in Growth, plus:",
    features: [
      { name: "Voorraad met Otis", text: "ziet wat opraakt voordat je misgrijpt", nameEn: "Stock with Otis", textEn: "spots what is running low before you run out" },
      { name: "Inkoopadvies", text: "wat en hoeveel je bijbestelt, met een concept-inkooporder die jij goedkeurt", nameEn: "Buying advice", textEn: "what and how much to reorder, with a draft purchase order you approve" },
      { name: "Onbeperkt team", text: "onbeperkt teamleden en kennisdocumenten", nameEn: "Unlimited team", textEn: "unlimited team members and knowledge documents" },
      { name: "Prioriteit", text: "je vragen aan ons gaan voor", nameEn: "Priority", textEn: "your questions to us come first" },
    ],
  },
];

/** €0,47 */
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
