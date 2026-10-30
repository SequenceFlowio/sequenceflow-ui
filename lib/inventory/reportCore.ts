import {
  addDays,
  buildActions,
  combineStock,
  computeInventoryMetrics,
  createVariantResolver,
  sellThrough,
  summarize,
  variantLabel,
  type InventorySettings,
  type InventorySummary,
  type SellThrough,
  type VariantHistory,
  type VariantMetrics,
} from "./core.ts";
import { buildQuestionReport, questionGroupLabel, questionInsight, type QuestionConversation, type QuestionGroup, type QuestionReport } from "./questionsCore.ts";

/**
 * Puts the stored rows together into per-variant histories and the report the
 * page, the weekly mail and MCP read. Pure: the database layer loads the rows,
 * this file decides what they mean.
 */

export type VariantRow = {
  provider: string;
  external_id: string;
  variant_key: string;
  product_external_id: string | null;
  product_title: string;
  variant_title: string | null;
  sku: string | null;
  ean: string | null;
  options: Record<string, string> | null;
  price: number | string | null;
  unit_cost: number | string | null;
  stock: number | null;
  stock_tracked: boolean;
  own_warehouse: boolean;
  status: string;
  first_seen_at: string;
};

export type SalesRow = { variant_key: string; day: string; channel: string; units_sold: number; revenue: number | string };
export type StockRow = { variant_key: string; day: string; stock: number };
export type DeliveryRow = { id: string; variant_key: string; received_on: string; quantity: number; source: string; note: string | null };
export type ReturnRow = { ean: string | null; reason: string | null; quantity: number };

export const REPORT_VERSION = 1;

export type DeliveryReport = SellThrough & { id: string; variantKey: string; label: string; note: string | null; upcoming: boolean };

export type InventoryReport = {
  version: number;
  builtAt: string;
  today: string;
  settings: InventorySettings;
  summary: InventorySummary;
  metrics: VariantMetrics[];
  deliveries: DeliveryReport[];
  channels: string[];
  historyFrom: string | null;
  /** Missing on reports built before customer questions were counted. */
  questions?: QuestionReport;
};

const num = (value: number | string | null | undefined) => (value === null || value === undefined || value === "" ? null : Number(value));

function productKeyOf(row: VariantRow) {
  return row.product_external_id ? `${row.provider}:${row.product_external_id}` : `title:${row.product_title.trim().toLowerCase()}`;
}

/**
 * One history per variant key. When several channels sell the same variant,
 * the webshop row names it (bol.com rows only know an EAN).
 */
export function buildHistories(input: {
  variants: VariantRow[];
  sales: SalesRow[];
  stock: StockRow[];
  deliveries: DeliveryRow[];
  returns: ReturnRow[];
  today: string;
}): VariantHistory[] {
  const preferred = new Map<string, VariantRow>();
  const channels = new Map<string, Set<string>>();
  const firstSeen = new Map<string, string>();
  for (const row of input.variants) {
    const current = preferred.get(row.variant_key);
    if (!current || (current.provider === "bol" && row.provider !== "bol") || (current.status === "archived" && row.status === "active")) preferred.set(row.variant_key, row);
    channels.set(row.variant_key, (channels.get(row.variant_key) ?? new Set()).add(row.provider));
    const day = row.first_seen_at.slice(0, 10);
    if (!firstSeen.has(row.variant_key) || day < firstSeen.get(row.variant_key)!) firstSeen.set(row.variant_key, day);
  }
  const stockNow = combineStock(input.variants.map((row) => ({
    variantKey: row.variant_key, provider: row.provider, stock: row.stock, stockTracked: row.stock_tracked, ownWarehouse: row.own_warehouse, status: row.status,
  })));

  const histories = new Map<string, VariantHistory>();
  const ensure = (key: string) => {
    let history = histories.get(key);
    if (!history) {
      const row = preferred.get(key);
      history = {
        variantKey: key,
        productKey: row ? productKeyOf(row) : `key:${key}`,
        productTitle: row?.product_title ?? key.replace(/^[a-z]+:/, ""),
        variantTitle: row?.variant_title ?? null,
        sku: row?.sku ?? null,
        ean: row?.ean ?? null,
        options: row?.options ?? {},
        channels: [...(channels.get(key) ?? [])],
        price: num(row?.price),
        unitCost: num(row?.unit_cost),
        stock: stockNow.has(key) ? stockNow.get(key)! : null,
        firstSeenDay: firstSeen.get(key) ?? input.today,
        sales: new Map(),
        revenue: new Map(),
        stockByDay: new Map(),
        incoming: 0,
        returns: { units: 0, reasons: {} },
      };
      histories.set(key, history);
    }
    return history;
  };

  // Archived variants without stock or recent sales are left out entirely.
  for (const [key, row] of preferred) if (row.status === "active" || (stockNow.get(key) ?? 0) > 0) ensure(key);

  for (const sale of input.sales) {
    if (!histories.has(sale.variant_key) && preferred.get(sale.variant_key)?.status === "archived") continue;
    const history = ensure(sale.variant_key);
    history.sales.set(sale.day, (history.sales.get(sale.day) ?? 0) + sale.units_sold);
    history.revenue.set(sale.day, (history.revenue.get(sale.day) ?? 0) + Number(sale.revenue || 0));
    if (sale.day < history.firstSeenDay) history.firstSeenDay = sale.day;
    if (!history.channels.includes(sale.channel)) history.channels.push(sale.channel);
  }
  for (const row of input.stock) {
    const history = histories.get(row.variant_key);
    if (history) history.stockByDay.set(row.day, row.stock);
  }
  for (const delivery of input.deliveries) {
    const history = histories.get(delivery.variant_key);
    if (history && delivery.received_on > input.today) history.incoming += delivery.quantity;
  }
  const resolve = createVariantResolver(input.variants.map((row) => ({ variantKey: row.variant_key, provider: row.provider, externalId: row.external_id, sku: row.sku, ean: row.ean })));
  for (const item of input.returns) {
    if (!item.ean) continue;
    const history = histories.get(resolve({ provider: "bol", ean: item.ean }));
    if (!history) continue;
    history.returns.units += item.quantity;
    if (item.reason) history.returns.reasons[item.reason] = (history.returns.reasons[item.reason] ?? 0) + item.quantity;
  }
  return [...histories.values()];
}

export function buildReport(input: Parameters<typeof buildHistories>[0] & { settings: InventorySettings; builtAt: string; conversations?: QuestionConversation[] }): InventoryReport {
  const histories = buildHistories(input);
  const questions = buildQuestionReport(input.conversations ?? [], histories.map((history) => ({
    variantKey: history.variantKey, productKey: history.productKey, productTitle: history.productTitle, options: history.options,
  })));
  const metrics = computeInventoryMetrics(histories, input.settings, input.today)
    .map((metric) => questions.byVariant[metric.variantKey] ? { ...metric, questions: questions.byVariant[metric.variantKey] } : metric);
  const byKey = new Map(histories.map((history) => [history.variantKey, history]));
  const deliveries: DeliveryReport[] = input.deliveries
    .filter((delivery) => byKey.has(delivery.variant_key))
    .sort((a, b) => b.received_on.localeCompare(a.received_on))
    .slice(0, 200)
    .map((delivery) => {
      const history = byKey.get(delivery.variant_key)!;
      const upcoming = delivery.received_on > input.today;
      return {
        ...sellThrough({ day: delivery.received_on, quantity: delivery.quantity, source: delivery.source }, history.sales, input.today),
        id: delivery.id,
        variantKey: delivery.variant_key,
        label: variantLabel(history),
        note: delivery.note,
        upcoming,
      };
    });
  const days = input.sales.map((sale) => sale.day).sort();
  return {
    version: REPORT_VERSION,
    builtAt: input.builtAt,
    today: input.today,
    settings: input.settings,
    summary: summarize(metrics),
    metrics,
    deliveries,
    channels: [...new Set(histories.flatMap((history) => history.channels))].sort(),
    historyFrom: days[0] ?? null,
    questions,
  };
}

// ── Views on a report ───────────────────────────────────────────────────────

export const STATUS_FILTERS = ["all", "attention", "dead", "low", "out_of_stock", "to_order", "healthy"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export function filterMetrics(metrics: VariantMetrics[], options: { status?: StatusFilter; search?: string; channel?: string | null }) {
  const search = options.search?.trim().toLowerCase() ?? "";
  return metrics.filter((metric) => {
    if (options.channel && !metric.channels.includes(options.channel)) return false;
    if (search) {
      const haystack = [metric.productTitle, metric.variantTitle, metric.sku, metric.ean, ...Object.values(metric.options)].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    switch (options.status ?? "all") {
      case "attention": return ["dead", "low", "out_of_stock"].includes(metric.status);
      case "dead": return metric.status === "dead";
      case "low": return metric.status === "low";
      case "out_of_stock": return metric.status === "out_of_stock";
      case "to_order": return metric.recommendedOrder > 0;
      case "healthy": return metric.status === "healthy" || metric.status === "new";
      default: return true;
    }
  });
}

const STATUS_ORDER: Record<VariantMetrics["status"], number> = { out_of_stock: 0, low: 1, dead: 2, slow: 3, new: 4, healthy: 5, inactive: 6, untracked: 7 };

export function sortMetrics(metrics: VariantMetrics[]) {
  return [...metrics].sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || (b.stockValue ?? 0) - (a.stockValue ?? 0)
    || b.velocityPerWeek - a.velocityPerWeek
    || a.productTitle.localeCompare(b.productTitle));
}

export type QuestionInsight = { label: string; text: string; count: number; topic: QuestionGroup["topTopic"]; variantKeys: string[] };

/** The groups customers ask most about, each with what it means for buying. */
export function reportQuestionInsights(report: InventoryReport, language: "nl" | "en", limit = 6): QuestionInsight[] {
  const statuses = new Map(report.metrics.map((metric) => [metric.variantKey, metric.status]));
  return (report.questions?.groups ?? []).slice(0, limit).map((group) => ({
    label: questionGroupLabel(group),
    text: questionInsight(group, statuses, language),
    count: group.count,
    topic: group.topTopic,
    variantKeys: group.variantKeys,
  }));
}

export function reportActions(report: InventoryReport, language: "nl" | "en", limit = 10) {
  return buildActions(report.metrics, report.settings, language, limit);
}

/** Is the cached report fresh enough to show, or should a sync rebuild it? */
export function reportIsStale(report: Pick<InventoryReport, "builtAt" | "version"> | null, now: Date) {
  if (!report || report.version !== REPORT_VERSION) return true;
  return now.getTime() - Date.parse(report.builtAt) > 26 * 60 * 60 * 1000;
}

export function historyWindowStart(today: string) {
  return addDays(today, -800);
}

export type ReportViewOptions = { status?: StatusFilter; search?: string; channel?: string | null; offset?: number; limit?: number; language: "nl" | "en" };

/** What the page (and MCP) gets: the summary, this week's actions and one page of variants. */
export function reportView(report: InventoryReport, options: ReportViewOptions) {
  const filtered = sortMetrics(filterMetrics(report.metrics, options));
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  return {
    builtAt: report.builtAt,
    today: report.today,
    historyFrom: report.historyFrom,
    channels: report.channels,
    settings: report.settings,
    summary: report.summary,
    actions: reportActions(report, options.language, 10),
    questions: { conversations: report.questions?.conversations ?? 0, insights: reportQuestionInsights(report, options.language) },
    variants: { total: filtered.length, offset, rows: filtered.slice(offset, offset + limit) },
    deliveries: report.deliveries.slice(0, 50),
  };
}

export function parseStatusFilter(value: string | null): StatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(value ?? "") ? value as StatusFilter : "all";
}
