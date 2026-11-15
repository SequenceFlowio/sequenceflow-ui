import { renderBrandedEmail, type MailBlock } from "../email/branded.ts";
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

export function weeklyInventoryEmail(input: { summary: InventorySummary; actions: InventoryAction[]; language: Language; appUrl: string; shopName: string | null; intro: string | null; questions?: Array<{ text: string }> }) {
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
    input.intro ?? (nl ? "Otis hier, je voorraadassistent. Dit is je wekelijkse inkoopadvies, op basis van je verkoop en voorraad per variant." : "Otis here, your stock assistant. This is your weekly buying advice, based on your sales and stock per variant."),
    "",
    ...overview,
    "",
    nl ? "Wat je deze week doet:" : "What to do this week:",
    ...actions,
    ...(input.questions?.length
      ? ["", nl ? "Wat klanten vroegen in je inbox:" : "What customers asked in your inbox:", ...input.questions.slice(0, 3).map((question) => `- ${question.text}`)]
      : []),
    "",
    nl ? `Alle varianten en de berekening per advies: ${input.appUrl}/inventory` : `All variants and how each advice is calculated: ${input.appUrl}/inventory`,
    nl ? `Deze mail uitzetten kan onder Instellingen op die pagina.` : `You can turn this email off under Settings on that page.`,
    "",
    "Otis",
    nl ? "Voorraadassistent van Support One" : "Stock assistant at Support One",
  ].join("\n");
  const blocks: MailBlock[] = [
    { type: "paragraph", text: input.intro ?? (nl ? "Otis hier, je voorraadassistent. Dit is je wekelijkse inkoopadvies, op basis van je verkoop en voorraad per variant." : "Otis here, your stock assistant. This is your weekly buying advice, based on your sales and stock per variant.") },
    { type: "stats", items: [
      { label: nl ? `dode voorraad, ${summary.deadVariants} varianten` : `dead stock, ${summary.deadVariants} variants`, value: money(summary.deadStockValue, input.language) },
      { label: nl ? "bijna op" : "running low", value: String(summary.lowVariants) },
      { label: nl ? "uitverkocht" : "sold out", value: String(summary.outOfStockVariants) },
      { label: nl ? `bijbestellen, ${summary.toOrderUnits} stuks` : `to reorder, ${summary.toOrderUnits} units`, value: String(summary.toOrderVariants) },
    ] },
    { type: "heading", text: nl ? "Wat je deze week doet" : "What to do this week" },
    input.actions.length
      ? { type: "list", items: input.actions.map((action) => ({ title: action.title, text: action.text })) }
      : { type: "paragraph", text: nl ? "Geen acties deze week: je voorraad loopt in de pas met de verkoop." : "No actions this week: your stock is in line with sales." },
  ];
  if (input.questions?.length) {
    blocks.push({ type: "heading", text: nl ? "Wat klanten vroegen in je inbox" : "What customers asked in your inbox" });
    blocks.push({ type: "list", ordered: false, items: input.questions.slice(0, 3).map((question) => ({ title: question.text })) });
  }
  blocks.push({ type: "button", label: nl ? "Alle varianten en de berekening" : "All variants and the calculation", href: `${input.appUrl}/inventory` });
  const html = renderBrandedEmail({
    language: input.language,
    eyebrow: nl ? "Otis · inkoopadvies" : "Otis · buying advice",
    title: nl ? `${input.actions.length} ${input.actions.length === 1 ? "actie" : "acties"} voor je voorraad${input.shopName ? ` van ${input.shopName}` : ""}` : `${input.actions.length} ${input.actions.length === 1 ? "action" : "actions"} for your stock${input.shopName ? ` at ${input.shopName}` : ""}`,
    blocks,
    signature: nl ? "Otis\nVoorraadassistent van Support One" : "Otis\nStock assistant at Support One",
    footer: [nl ? "Deze mail uitzetten kan onder Instellingen op de voorraadpagina in Support One." : "You can turn this email off under Settings on the stock page in Support One."],
  });
  return { subject, text, html };
}

/** Monday in Amsterdam, and no mail in the last 6 days. */
export function weeklyEmailDue(now: Date, lastSentAt: string | null) {
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "short" }).format(now);
  return weekday === "Mon" && (!lastSentAt || shopDay(lastSentAt) <= addDays(shopDay(now), -6));
}
