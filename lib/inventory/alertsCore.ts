import { addDays, daysBetween, productSettings, variantLabel, type VariantMetrics } from "./core.ts";
import type { InventoryReport } from "./reportCore.ts";

/**
 * Otis's triggers: when the stock assistant speaks up on his own. Pure, like
 * the rest of the advice: every alert comes from the report's own numbers. An
 * alert has a fingerprint; while the same fingerprint keeps coming back it is
 * one open alert, so nobody gets the same message every day.
 */

type Language = "nl" | "en";

export const ALERT_KINDS = ["stock_below", "days_below", "sold_out", "sales_spike", "questions_on_short", "back_in_stock", "season_ahead", "delivery_late", "dead_stock_value", "margin_below", "returns_above"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];
export type AlertScope = "all" | "product" | "variant";

export type AlertRule = {
  id: string;
  kind: AlertKind;
  scope: AlertScope;
  targetKey: string | null;
  targetLabel: string | null;
  threshold: number | null;
  enabled: boolean;
};

export type AlertHit = {
  ruleId: string;
  kind: AlertKind;
  fingerprint: string;
  variantKey: string | null;
  title: string;
  body: string;
  /** Euros at stake, for the order of the list and the mail. */
  impact: number;
};

/** What each trigger means, its threshold and which scopes make sense. */
export const ALERT_KIND_INFO: Record<AlertKind, { label: [string, string]; threshold: [string, string] | null; defaultThreshold: number | null; min?: number; max?: number; scopes: AlertScope[] }> = {
  stock_below: { label: ["Voorraad onder een aantal", "Stock below a number"], threshold: ["stuks", "units"], defaultThreshold: 10, min: 0, max: 100_000, scopes: ["all", "product", "variant"] },
  days_below: { label: ["Minder dagen voorraad dan", "Fewer days of stock than"], threshold: ["dagen", "days"], defaultThreshold: 14, min: 1, max: 365, scopes: ["all", "product", "variant"] },
  sold_out: { label: ["Uitverkocht terwijl er vraag is", "Sold out while people buy it"], threshold: null, defaultThreshold: null, scopes: ["all", "product", "variant"] },
  sales_spike: { label: ["Verkoop piekt", "Sales spike"], threshold: ["× zo veel als normaal", "× the usual"], defaultThreshold: 2, min: 1.2, max: 20, scopes: ["all", "product", "variant"] },
  questions_on_short: { label: ["Klanten vragen naar iets dat (bijna) op is", "Customers ask for something (almost) sold out"], threshold: ["vragen", "questions"], defaultThreshold: 3, min: 1, max: 1000, scopes: ["all", "product", "variant"] },
  season_ahead: { label: ["Seizoen komt eraan en er ligt te weinig", "Season ahead with too little stock"], threshold: ["weken van tevoren", "weeks ahead"], defaultThreshold: 6, min: 1, max: 26, scopes: ["all", "product"] },
  delivery_late: { label: ["Levering is te laat", "Delivery is late"], threshold: ["dagen te laat", "days late"], defaultThreshold: 3, min: 1, max: 60, scopes: ["all", "product", "variant"] },
  dead_stock_value: { label: ["Dode voorraad boven een bedrag", "Dead stock above an amount"], threshold: ["euro", "euros"], defaultThreshold: 5000, min: 1, max: 10_000_000, scopes: ["all"] },
  back_in_stock: { label: ["Weer op voorraad terwijl klanten ernaar vroegen", "Back in stock while customers asked for it"], threshold: ["vragen", "questions"], defaultThreshold: 2, min: 1, max: 1000, scopes: ["all", "product", "variant"] },
  margin_below: { label: ["Marge onder een percentage", "Margin below a percentage"], threshold: ["% marge", "% margin"], defaultThreshold: 20, min: 0, max: 100, scopes: ["all", "product", "variant"] },
  returns_above: { label: ["Retourpercentage boven", "Return rate above"], threshold: ["% retour", "% returned"], defaultThreshold: 20, min: 1, max: 100, scopes: ["all", "product", "variant"] },
};

/** Rules every workspace starts with; all can be changed or turned off. */
export const DEFAULT_ALERT_RULES: Array<Pick<AlertRule, "kind" | "threshold">> = [
  { kind: "sold_out", threshold: null },
  { kind: "questions_on_short", threshold: 3 },
  { kind: "back_in_stock", threshold: 2 },
  { kind: "sales_spike", threshold: 2 },
  { kind: "season_ahead", threshold: 6 },
  { kind: "delivery_late", threshold: 3 },
];

export function alertKindLabel(kind: AlertKind, language: Language) {
  return ALERT_KIND_INFO[kind].label[language === "nl" ? 0 : 1];
}

/** A rule's threshold within its bounds, or the default; null for triggers without one. */
export function normalizeThreshold(kind: AlertKind, value: unknown) {
  const info = ALERT_KIND_INFO[kind];
  if (!info.threshold) return null;
  const number = value === null || value === undefined || value === "" ? info.defaultThreshold : Number(value);
  if (number === null || !Number.isFinite(number) || number < (info.min ?? 0) || number > (info.max ?? Infinity)) return undefined;
  return Math.round(number * 100) / 100;
}

const money = (value: number, language: Language) =>
  new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const amount = (value: number, language: Language) =>
  new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 }).format(value);

const MONTHS_NL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function inScope(rule: AlertRule, metric: VariantMetrics) {
  if (rule.scope === "product") return metric.productKey === rule.targetKey;
  if (rule.scope === "variant") return metric.variantKey === rule.targetKey;
  return true;
}

function orderNote(metric: VariantMetrics, language: Language) {
  const nl = language === "nl";
  const incoming = metric.incoming > 0 ? (nl ? ` Er zijn er ${metric.incoming} onderweg.` : ` ${metric.incoming} are on their way.`) : "";
  const order = metric.recommendedOrder > 0 ? (nl ? ` Advies: bestel ${metric.recommendedOrder} stuks.` : ` Advice: order ${metric.recommendedOrder}.`) : "";
  return incoming + order;
}

/** The first day of each season start (a month whose previous month is not in the season) in the coming year. */
function seasonStarts(months: number[], today: string) {
  const set = new Set(months);
  const starts: string[] = [];
  const year = Number(today.slice(0, 4));
  for (const month of months) {
    if (set.has(((month + 10) % 12) + 1)) continue;
    for (const candidate of [year, year + 1]) {
      const day = `${candidate}-${String(month).padStart(2, "0")}-01`;
      if (day > today) {
        starts.push(day);
        break;
      }
    }
  }
  return starts.sort();
}

export function evaluateAlerts(report: InventoryReport, rules: AlertRule[], language: Language): AlertHit[] {
  const nl = language === "nl";
  const today = report.today;
  const hits: AlertHit[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const metrics = report.metrics.filter((metric) => inScope(rule, metric) && metric.stock != null);
    const threshold = rule.threshold ?? ALERT_KIND_INFO[rule.kind].defaultThreshold ?? 0;
    const hit = (metric: VariantMetrics | null, title: string, body: string, impact: number, extra = "") => hits.push({
      ruleId: rule.id,
      kind: rule.kind,
      fingerprint: `${rule.id}:${metric?.variantKey ?? "all"}${extra ? `:${extra}` : ""}`.slice(0, 600),
      variantKey: metric?.variantKey ?? null,
      title: title.slice(0, 300),
      body: body.slice(0, 1000),
      impact: Math.round(impact * 100) / 100,
    });

    switch (rule.kind) {
      case "stock_below":
      case "days_below":
        for (const metric of metrics) {
          const selling = metric.velocityPerWeek > 0 || metric.sold90 > 0;
          if (!selling || (metric.stock ?? 0) <= 0 || metric.status === "dead" || metric.status === "off_season") continue;
          const below = rule.kind === "stock_below" ? (metric.stock ?? 0) <= threshold : metric.daysOfStock != null && metric.daysOfStock <= threshold;
          if (!below) continue;
          const days = metric.daysOfStock == null ? null : Math.max(0, Math.floor(metric.daysOfStock));
          const label = variantLabel(metric);
          hit(metric,
            nl ? `Bijna op: ${label}` : `Running low: ${label}`,
            (nl
              ? `Nog ${metric.stock} op voorraad${rule.kind === "stock_below" ? ` (je grens is ${threshold})` : ""}. Verkoopt ongeveer ${amount(metric.velocityPerWeek, language)} per week${days != null ? `, dus over ${days} dagen op` : ""}.`
              : `${metric.stock} left${rule.kind === "stock_below" ? ` (your limit is ${threshold})` : ""}. Sells about ${amount(metric.velocityPerWeek, language)} a week${days != null ? `, so out in ${days} days` : ""}.`) + orderNote(metric, language),
            (metric.velocityPerWeek / 7) * Math.max(0, productSettings(report.settings, metric.productKey).leadTimeDays - (days ?? 0)) * (metric.price ?? 0));
        }
        break;

      case "sold_out":
        for (const metric of metrics) {
          if (metric.status !== "out_of_stock" || metric.velocityPerWeek <= 0) continue;
          const lost = metric.velocityPerWeek * (metric.price ?? 0) * (productSettings(report.settings, metric.productKey).leadTimeDays / 7);
          hit(metric,
            nl ? `Uitverkocht: ${variantLabel(metric)}` : `Sold out: ${variantLabel(metric)}`,
            (nl
              ? `Verkocht ongeveer ${amount(metric.velocityPerWeek, language)} per week toen hij op voorraad was.${lost > 0 ? ` Zo'n ${money(lost, language)} omzet per levertijd loopt je mis.` : ""}`
              : `Sold about ${amount(metric.velocityPerWeek, language)} a week while in stock.${lost > 0 ? ` About ${money(lost, language)} in sales per lead time is missed.` : ""}`) + orderNote(metric, language),
            lost);
        }
        break;

      case "sales_spike":
        for (const metric of metrics) {
          // The usual week: the 83 days before this week.
          const usual = ((metric.sold90 - metric.sold7) / 83) * 7;
          if (metric.sold7 < 5 || usual <= 0 || metric.sold7 < usual * threshold) continue;
          const factor = metric.sold7 / usual;
          hit(metric,
            nl ? `Verkoop piekt: ${variantLabel(metric)}` : `Sales spike: ${variantLabel(metric)}`,
            nl
              ? `${metric.sold7} verkocht in 7 dagen, ${amount(factor, language)}× zo veel als een normale week (${amount(usual, language)}). Nog ${metric.stock} op voorraad.${metric.daysOfStock != null && metric.daysOfStock < 60 ? " Houdt dit aan, dan ben je eerder door je voorraad heen dan het advies nu zegt." : ""}`
              : `${metric.sold7} sold in 7 days, ${amount(factor, language)}× a normal week (${amount(usual, language)}). ${metric.stock} in stock.${metric.daysOfStock != null && metric.daysOfStock < 60 ? " If this keeps up, you run out sooner than the advice says now." : ""}`,
            (metric.sold7 - usual) * (metric.price ?? 0));
        }
        break;

      case "questions_on_short":
        for (const metric of metrics) {
          const asked = metric.questions?.total ?? 0;
          if (asked < threshold || (metric.status !== "out_of_stock" && metric.status !== "low")) continue;
          hit(metric,
            nl ? `Klanten vragen ernaar: ${variantLabel(metric)}` : `Customers ask for it: ${variantLabel(metric)}`,
            (nl
              ? `${asked} klanten vroegen de laatste 90 dagen naar deze variant, en hij is ${metric.status === "out_of_stock" ? "uitverkocht" : "bijna op"}.`
              : `${asked} customers asked about this variant in the last 90 days, and it is ${metric.status === "out_of_stock" ? "sold out" : "almost gone"}.`) + orderNote(metric, language),
            asked * (metric.price ?? 0));
        }
        break;

      case "back_in_stock": {
        // Came in during the last two weeks, is in stock now, and customers asked when it would be back.
        const recent = addDays(today, -14);
        for (const metric of metrics) {
          const asked = metric.questions?.topics?.availability ?? 0;
          if (asked < threshold || (metric.stock ?? 0) <= 0) continue;
          const delivery = report.deliveries.filter((row) => row.variantKey === metric.variantKey && !row.upcoming && row.day >= recent).sort((a, b) => b.day.localeCompare(a.day))[0];
          if (!delivery) continue;
          hit(metric,
            nl ? `Weer op voorraad: ${variantLabel(metric)}` : `Back in stock: ${variantLabel(metric)}`,
            nl
              ? `${asked} ${asked === 1 ? "klant vroeg" : "klanten vroegen"} de laatste 90 dagen wanneer deze variant weer binnen zou zijn. Er kwamen ${delivery.quantity} stuks binnen op ${delivery.day}; nu ${metric.stock} op voorraad. Laat het ze weten via de wachtlijst onder Wat aandacht vraagt.`
              : `${asked} ${asked === 1 ? "customer" : "customers"} asked in the last 90 days when this variant would be back. ${delivery.quantity} units arrived on ${delivery.day}; ${metric.stock} in stock now. Tell them through the waitlist under What needs attention.`,
            asked * (metric.price ?? 0), delivery.id);
        }
        break;
      }

      case "margin_below":
        for (const metric of metrics) {
          if (metric.marginPct == null || metric.marginPct >= threshold || metric.sold90 <= 0) continue;
          hit(metric,
            nl ? `Lage marge: ${variantLabel(metric)}` : `Low margin: ${variantLabel(metric)}`,
            nl
              ? `${amount(metric.marginPct, language)}% marge (verkoopprijs ${money(metric.price ?? 0, language)}, inkoop ${money(metric.unitCost ?? 0, language)}), onder je grens van ${threshold}%. ${metric.sold90} verkocht in 90 dagen${metric.grossMargin90 != null ? `, samen ${money(metric.grossMargin90, language)} brutomarge` : ""}. Overweeg een hogere prijs of een goedkopere inkoop voordat je bijbestelt.`
              : `${amount(metric.marginPct, language)}% margin (price ${money(metric.price ?? 0, language)}, cost ${money(metric.unitCost ?? 0, language)}), below your limit of ${threshold}%. ${metric.sold90} sold in 90 days${metric.grossMargin90 != null ? `, ${money(metric.grossMargin90, language)} gross margin in total` : ""}. Consider a higher price or a cheaper source before reordering.`,
            Math.max(0, (threshold / 100) * (metric.price ?? 0) * metric.sold90 - (metric.grossMargin90 ?? 0)));
        }
        break;

      case "returns_above":
        for (const metric of metrics) {
          if (metric.returnRate == null || metric.returnRate < threshold) continue;
          const reason = metric.returns.topReason ? (nl ? ` Meest genoemde reden: ${metric.returns.topReason} (${metric.returns.topReasonCount}×).` : ` Most named reason: ${metric.returns.topReason} (${metric.returns.topReasonCount}×).`) : "";
          hit(metric,
            nl ? `Veel retouren: ${variantLabel(metric)}` : `Many returns: ${variantLabel(metric)}`,
            nl
              ? `${amount(metric.returnRate, language)}% van de ${metric.sold365} verkochte stuks kwam terug (${metric.returns.units}), boven je grens van ${threshold}%.${reason} Kijk naar de maattabel of de productfoto's voordat je bijbestelt.`
              : `${amount(metric.returnRate, language)}% of the ${metric.sold365} units sold came back (${metric.returns.units}), above your limit of ${threshold}%.${reason} Check the size chart or the product photos before reordering.`,
            metric.returns.units * (metric.price ?? 0) * 0.2);
        }
        break;

      case "season_ahead": {
        const products = new Map<string, VariantMetrics[]>();
        for (const metric of metrics) if (metric.seasonMonths) products.set(metric.productKey, [...(products.get(metric.productKey) ?? []), metric]);
        for (const variants of products.values()) {
          const start = seasonStarts(variants[0].seasonMonths!, today).find((day) => daysBetween(today, day) <= threshold * 7);
          if (!start) continue;
          const toOrder = variants.filter((variant) => variant.recommendedOrder > 0);
          if (!toOrder.length) continue;
          const units = toOrder.reduce((sum, variant) => sum + variant.recommendedOrder, 0);
          const month = Number(start.slice(5, 7)) - 1;
          const title = variants[0].productTitle;
          const weeks = Math.max(1, Math.round(daysBetween(today, start) / 7));
          const tooLate = daysBetween(today, start) < productSettings(report.settings, variants[0].productKey).leadTimeDays;
          hits.push({
            ruleId: rule.id,
            kind: rule.kind,
            fingerprint: `${rule.id}:${variants[0].productKey}:${start}`.slice(0, 600),
            variantKey: null,
            title: (nl ? `Seizoen komt eraan: ${title}` : `Season ahead: ${title}`).slice(0, 300),
            body: (nl
              ? `Het seizoen van ${title} begint in ${MONTHS_NL[month]}, over ongeveer ${weeks} ${weeks === 1 ? "week" : "weken"}. Voor ${toOrder.length} ${toOrder.length === 1 ? "variant" : "varianten"} ligt te weinig: samen ${units} stuks bijbestellen.${tooLate ? " Je levertijd is langer dan de tijd tot het seizoen, dus bestel zo snel mogelijk." : ""}`
              : `The season of ${title} starts in ${MONTHS_EN[month]}, in about ${weeks} ${weeks === 1 ? "week" : "weeks"}. ${toOrder.length} ${toOrder.length === 1 ? "variant has" : "variants have"} too little stock: ${units} units to order in total.${tooLate ? " Your lead time is longer than the time left, so order as soon as possible." : ""}`).slice(0, 1000),
            impact: Math.round(toOrder.reduce((sum, variant) => sum + variant.recommendedOrder * (variant.price ?? 0) * 0.1, 0) * 100) / 100,
          });
        }
        break;
      }

      case "delivery_late": {
        const inScopeKeys = new Set(metrics.map((metric) => metric.variantKey));
        const byKey = new Map(metrics.map((metric) => [metric.variantKey, metric]));
        for (const delivery of report.deliveries) {
          if (delivery.upcoming || delivery.source === "detected" || !inScopeKeys.has(delivery.variantKey)) continue;
          const late = daysBetween(delivery.day, today);
          if (late < threshold || late > 60) continue;
          // Arrived after all: a stock jump from a week before the expected day.
          const arrived = report.deliveries.some((other) => other.source === "detected" && other.variantKey === delivery.variantKey && other.day >= addDays(delivery.day, -7));
          if (arrived) continue;
          const metric = byKey.get(delivery.variantKey)!;
          hit(metric,
            nl ? `Levering te laat: ${delivery.label}` : `Delivery late: ${delivery.label}`,
            nl
              ? `${delivery.quantity} stuks werden verwacht op ${delivery.day}, ${late} dagen geleden, maar de voorraad is niet gestegen. Nog ${metric.stock} op voorraad. Vraag de leverancier waar ze blijven, of zet de leverdatum op de pagina goed.`
              : `${delivery.quantity} units were expected on ${delivery.day}, ${late} days ago, but stock did not go up. ${metric.stock} in stock. Ask the supplier, or correct the date on the page.`,
            metric.velocityPerWeek * (metric.price ?? 0) * (late / 7), delivery.id);
        }
        break;
      }

      case "dead_stock_value": {
        const dead = report.metrics.filter((metric) => metric.status === "dead" && (metric.stockValue ?? 0) > 0)
          .sort((a, b) => (b.stockValue ?? 0) - (a.stockValue ?? 0));
        const value = dead.reduce((sum, metric) => sum + (metric.stockValue ?? 0), 0);
        if (value < threshold) break;
        const top = dead.slice(0, 3).map((metric) => `${variantLabel(metric)} (${money(metric.stockValue ?? 0, language)})`).join(", ");
        hit(null,
          nl ? `${money(value, language)} staat vast in dode voorraad` : `${money(value, language)} tied up in dead stock`,
          nl
            ? `Dat is meer dan je grens van ${money(threshold, language)}, verdeeld over ${dead.length} varianten. Het meeste zit in ${top}. Overweeg een actie of korting en koop deze niet bij.`
            : `That is above your limit of ${money(threshold, language)}, across ${dead.length} variants. Most is in ${top}. Consider a promotion and do not reorder these.`,
          value);
        break;
      }
    }
  }
  // One variant can trip several rules (sold out and asked about): keep each fingerprint once, biggest first.
  const seen = new Set<string>();
  return hits.sort((a, b) => b.impact - a.impact).filter((alert) => !seen.has(alert.fingerprint) && seen.add(alert.fingerprint));
}

/** Which open alerts to add and which to close, given what is true today. */
export function diffAlerts(open: Array<{ id: string; fingerprint: string }>, hits: AlertHit[]) {
  const openKeys = new Set(open.map((alert) => alert.fingerprint));
  const hitKeys = new Set(hits.map((alert) => alert.fingerprint));
  return {
    add: hits.filter((alert) => !openKeys.has(alert.fingerprint)),
    resolve: open.filter((alert) => !hitKeys.has(alert.fingerprint)).map((alert) => alert.id),
  };
}

// ── Mail ────────────────────────────────────────────────────────────────────

export const ASSISTANT_NAME = "Otis";

/** The daily mail with what Otis noticed since yesterday. */
export function alertEmail(input: { alerts: Array<Pick<AlertHit, "title" | "body">>; language: Language; appUrl: string; shopName: string | null }) {
  const nl = input.language === "nl";
  const count = input.alerts.length;
  const subject = nl
    ? `${ASSISTANT_NAME}: ${count} ${count === 1 ? "ding" : "dingen"} in je voorraad${input.shopName ? ` van ${input.shopName}` : ""}`
    : `${ASSISTANT_NAME}: ${count} ${count === 1 ? "thing" : "things"} in your stock${input.shopName ? ` at ${input.shopName}` : ""}`;
  const text = [
    nl ? "Hoi," : "Hi,",
    "",
    nl
      ? `${ASSISTANT_NAME} hier, je voorraadassistent. Bij de controle van vannacht viel me dit op:`
      : `${ASSISTANT_NAME} here, your stock assistant. Last night's check showed this:`,
    "",
    ...input.alerts.flatMap((alert, index) => [`${index + 1}. ${alert.title}`, `   ${alert.body}`, ""]),
    nl ? `Alles op een rij, en zelf instellen wanneer ik iets meld: ${input.appUrl}/inventory` : `Everything in one place, and when I should tell you: ${input.appUrl}/inventory`,
    nl ? "Deze mails uitzetten kan op die pagina onder Instellingen." : "You can turn these emails off on that page under Settings.",
    "",
    ASSISTANT_NAME,
    nl ? "Voorraadassistent van Support One" : "Stock assistant at Support One",
  ].join("\n");
  return { subject, text };
}
