import { addDays, shopDay, type InventoryAction, type InventorySummary } from "./core.ts";

/**
 * The weekly inkoopadvies mail. Plain text, built from the same actions the
 * page shows. An AI-written intro is optional and only used when every number
 * in it also appears in our own figures.
 */

type Language = "nl" | "en";

const money = (value: number, language: Language) =>
  new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

/** The facts the AI may use, and nothing else. */
export function introFacts(summary: InventorySummary, actions: InventoryAction[]) {
  return {
    deadVariants: summary.deadVariants,
    deadStockValueEur: Math.round(summary.deadStockValue),
    lowVariants: summary.lowVariants,
    outOfStockVariants: summary.outOfStockVariants,
    toOrderVariants: summary.toOrderVariants,
    toOrderUnits: summary.toOrderUnits,
    topActions: actions.slice(0, 3).map((action) => ({ title: action.title, text: action.text })),
  };
}

function numbersIn(text: string) {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((value) => value.replace(/[.,]/g, ""));
}

/** True when the intro only repeats numbers from the facts (formatted any way). */
export function introIsGrounded(intro: string, facts: ReturnType<typeof introFacts>) {
  const allowed = new Set(numbersIn(JSON.stringify(facts)));
  return numbersIn(intro).every((value) => allowed.has(value));
}

export function weeklyInventoryEmail(input: { summary: InventorySummary; actions: InventoryAction[]; language: Language; appUrl: string; shopName: string | null; intro: string | null }) {
  const nl = input.language === "nl";
  const { summary } = input;
  const subject = nl
    ? `Inkoopadvies deze week${input.shopName ? ` voor ${input.shopName}` : ""}: ${input.actions.length} ${input.actions.length === 1 ? "actie" : "acties"}`
    : `This week's buying advice${input.shopName ? ` for ${input.shopName}` : ""}: ${input.actions.length} ${input.actions.length === 1 ? "action" : "actions"}`;
  const overview = nl
    ? [
      `Dode voorraad: ${summary.deadVariants} varianten, ${money(summary.deadStockValue, "nl")} vast.`,
      `Bijna op: ${summary.lowVariants}. Uitverkocht: ${summary.outOfStockVariants}.`,
      `Bijbestellen: ${summary.toOrderVariants} varianten, samen ${summary.toOrderUnits} stuks.`,
    ]
    : [
      `Dead stock: ${summary.deadVariants} variants, ${money(summary.deadStockValue, "en")} tied up.`,
      `Running low: ${summary.lowVariants}. Sold out: ${summary.outOfStockVariants}.`,
      `To reorder: ${summary.toOrderVariants} variants, ${summary.toOrderUnits} units in total.`,
    ];
  const actions = input.actions.length
    ? input.actions.map((action, index) => `${index + 1}. ${action.title}\n   ${action.text}`)
    : [nl ? "Geen acties deze week: je voorraad loopt in de pas met de verkoop." : "No actions this week: your stock is in line with sales."];
  const text = [
    nl ? "Hoi," : "Hi,",
    "",
    input.intro ?? (nl ? "Dit is je wekelijkse inkoopadvies van Support One, op basis van je verkoop en voorraad per variant." : "This is your weekly buying advice from Support One, based on your sales and stock per variant."),
    "",
    ...overview,
    "",
    nl ? "Wat je deze week doet:" : "What to do this week:",
    ...actions,
    "",
    nl ? `Alle varianten en de berekening per advies: ${input.appUrl}/inventory` : `All variants and how each advice is calculated: ${input.appUrl}/inventory`,
    nl ? `Deze mail uitzetten kan onder Instellingen op die pagina.` : `You can turn this email off under Settings on that page.`,
    "",
    "Support One",
  ].join("\n");
  return { subject, text };
}

/** Monday in Amsterdam, and no mail in the last 6 days. */
export function weeklyEmailDue(now: Date, lastSentAt: string | null) {
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "short" }).format(now);
  return weekday === "Mon" && (!lastSentAt || shopDay(lastSentAt) <= addDays(shopDay(now), -6));
}
