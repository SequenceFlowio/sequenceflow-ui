/**
 * Inkoopadvies per variant: the arithmetic. Pure functions only (no database,
 * no network, no AI), so every number the merchant sees can be tested and
 * explained. The AI may summarise these results; it never computes them.
 */

export type InventoryChannel = "shopify" | "woocommerce" | "bol" | "import";

export type InventorySettings = {
  leadTimeDays: number;
  coverWeeks: number;
  safetyBuffer: number;
  deadAfterDays: number;
  deadCoverWeeks: number;
};

export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  leadTimeDays: 21,
  coverWeeks: 8,
  safetyBuffer: 0.2,
  deadAfterDays: 90,
  deadCoverWeeks: 26,
};

/** Days of recent sales the speed is based on. */
export const VELOCITY_WINDOW_DAYS = 56;
const MIN_IN_STOCK_DAYS = 14;
const NEW_VARIANT_DAYS = 28;
const LOW_VOLUME_UNITS = 5;
const PRODUCT_CURVE_MIN_UNITS = 10;

// ── Days ────────────────────────────────────────────────────────────────────

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });

/** The shop's calendar day (Amsterdam) of a timestamp, as YYYY-MM-DD. */
export function shopDay(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return DAY_FORMAT.format(date);
}

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

// ── Variant identity ────────────────────────────────────────────────────────

export function normalizeSku(value: unknown) {
  const sku = typeof value === "string" ? value.trim().toUpperCase() : "";
  return sku && sku.length <= 120 ? sku : null;
}

export function normalizeEan(value: unknown) {
  const digits = typeof value === "string" || typeof value === "number" ? String(value).replace(/\D/g, "") : "";
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function lower(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * One key per variant across channels: SKU first (the merchant's own code),
 * then EAN, then the provider's id, then the title as a last resort.
 */
export function variantKeyFor(input: { sku?: string | null; ean?: string | null; provider?: string | null; externalId?: string | null; title?: string | null; variantTitle?: string | null }) {
  const sku = normalizeSku(input.sku);
  if (sku) return `sku:${sku}`;
  const ean = normalizeEan(input.ean);
  if (ean) return `ean:${ean}`;
  if (input.provider && input.externalId) return `${input.provider}:${input.externalId}`.slice(0, 400);
  return `title:${lower(input.title)}|${lower(input.variantTitle)}`.slice(0, 400);
}

export type CatalogIdentity = { variantKey: string; provider: string; externalId: string; sku: string | null; ean: string | null };

export type SoldItem = {
  provider: string;
  variantExternalId?: string | null;
  offerExternalId?: string | null;
  sku?: string | null;
  ean?: string | null;
  title?: string | null;
  variantTitle?: string | null;
};

/** Maps an order line to the catalog variant it belongs to, so bol.com and webshop sales of one EAN add up. */
export function createVariantResolver(catalog: CatalogIdentity[]) {
  const byExternal = new Map<string, string>();
  const bySku = new Map<string, string>();
  const byEan = new Map<string, string>();
  for (const entry of catalog) {
    byExternal.set(`${entry.provider}:${entry.externalId}`, entry.variantKey);
    const sku = normalizeSku(entry.sku);
    if (sku && !bySku.has(sku)) bySku.set(sku, entry.variantKey);
    const ean = normalizeEan(entry.ean);
    if (ean && !byEan.has(ean)) byEan.set(ean, entry.variantKey);
  }
  return (item: SoldItem) => {
    const external = (item.variantExternalId && byExternal.get(`${item.provider}:${item.variantExternalId}`))
      || (item.offerExternalId && byExternal.get(`${item.provider}:${item.offerExternalId}`));
    if (external) return external;
    const sku = normalizeSku(item.sku);
    if (sku && bySku.has(sku)) return bySku.get(sku)!;
    const ean = normalizeEan(item.ean);
    if (ean && byEan.has(ean)) return byEan.get(ean)!;
    return variantKeyFor({ sku: item.sku, ean: item.ean, provider: item.provider, externalId: item.variantExternalId ?? item.offerExternalId, title: item.title, variantTitle: item.variantTitle });
  };
}

// ── Daily sales ─────────────────────────────────────────────────────────────

export type OrderForRollup = {
  provider: "shopify" | "woocommerce" | "bol";
  createdAt: string;
  cancelledAt: string | null;
  items: Array<SoldItem & { quantity: number; unitPrice?: number | null }>;
};

export type DailySalesRow = { variantKey: string; day: string; channel: InventoryChannel; unitsSold: number; revenue: number; orders: number };

/**
 * Units, revenue and orders per variant, day and channel. Cancelled orders do
 * not count. Lines without a price (Shopify, WooCommerce) are valued at the
 * variant's current price when `fallbackPrice` knows it.
 */
export function aggregateDailySales(orders: OrderForRollup[], resolve: (item: SoldItem) => string, fallbackPrice: (variantKey: string) => number | null = () => null) {
  const rows = new Map<string, DailySalesRow>();
  for (const order of orders) {
    if (order.cancelledAt) continue;
    const day = shopDay(order.createdAt);
    const seen = new Set<string>();
    for (const item of order.items) {
      const quantity = Math.floor(Number(item.quantity));
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      const variantKey = resolve({ ...item, provider: order.provider });
      const id = `${variantKey}\u0000${day}\u0000${order.provider}`;
      const row = rows.get(id) ?? { variantKey, day, channel: order.provider, unitsSold: 0, revenue: 0, orders: 0 };
      row.unitsSold += quantity;
      const price = item.unitPrice != null && Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : fallbackPrice(variantKey);
      if (price != null) row.revenue = round2(row.revenue + price * quantity);
      if (!seen.has(id)) {
        row.orders += 1;
        seen.add(id);
      }
      rows.set(id, row);
    }
  }
  return [...rows.values()];
}

// ── Stock per variant ───────────────────────────────────────────────────────

export type StockSource = { variantKey: string; provider: string; stock: number | null; stockTracked: boolean; ownWarehouse: boolean; status?: string };

/**
 * Stock per variant over all channels. Own-warehouse stock (webshop, or bol.com
 * FBR when there is no webshop) is counted once; bol.com LVB stock is added.
 * Returns null for a variant whose stock nobody tracks.
 */
export function combineStock(sources: StockSource[]) {
  const grouped = new Map<string, StockSource[]>();
  for (const source of sources) {
    if (source.status === "archived") continue;
    grouped.set(source.variantKey, [...(grouped.get(source.variantKey) ?? []), source]);
  }
  const result = new Map<string, number | null>();
  for (const [key, rows] of grouped) {
    const tracked = rows.filter((row) => row.stockTracked && row.stock != null);
    if (!tracked.length) {
      result.set(key, null);
      continue;
    }
    const webshop = tracked.filter((row) => row.ownWarehouse && row.provider !== "bol");
    const bolOwn = tracked.filter((row) => row.ownWarehouse && row.provider === "bol");
    const external = tracked.filter((row) => !row.ownWarehouse);
    const own = webshop.length
      ? webshop.reduce((sum, row) => sum + Number(row.stock), 0)
      : Math.max(0, ...bolOwn.map((row) => Number(row.stock)));
    result.set(key, own + external.reduce((sum, row) => sum + Number(row.stock), 0));
  }
  return result;
}

// ── Deliveries ──────────────────────────────────────────────────────────────

export type DetectedDelivery = { day: string; quantity: number };

/**
 * A delivery shows up as stock rising by more than the day's sales explain:
 * received = stock today − stock yesterday + sold today. Small rises are
 * returns or corrections, so the bar grows with the stock level.
 */
export function detectDeliveries(stockByDay: Map<string, number>, salesByDay: Map<string, number>) {
  const days = [...stockByDay.keys()].sort();
  const deliveries: DetectedDelivery[] = [];
  for (let index = 1; index < days.length; index += 1) {
    const day = days[index];
    const previousDay = days[index - 1];
    if (daysBetween(previousDay, day) !== 1) continue;
    const previous = stockByDay.get(previousDay)!;
    const received = stockByDay.get(day)! - previous + (salesByDay.get(day) ?? 0);
    if (received >= Math.max(3, Math.ceil(Math.max(previous, 0) * 0.1))) deliveries.push({ day, quantity: received });
  }
  return deliveries;
}

export type SellThrough = { day: string; quantity: number; source: string; after30: number | null; after60: number | null; after90: number | null; soldSince: number };

/** Share of a delivery sold 30, 60 and 90 days after it arrived (null while that day has not come yet). */
export function sellThrough(delivery: { day: string; quantity: number; source: string }, salesByDay: Map<string, number>, today: string): SellThrough {
  const soldWithin = (days: number) => {
    let sold = 0;
    for (let offset = 0; offset < days; offset += 1) sold += salesByDay.get(addDays(delivery.day, offset)) ?? 0;
    return sold;
  };
  const elapsed = daysBetween(delivery.day, today);
  const share = (days: number) => elapsed >= days ? Math.min(1, round2(soldWithin(days) / delivery.quantity)) : null;
  return { ...delivery, after30: share(30), after60: share(60), after90: share(90), soldSince: soldWithin(Math.max(0, elapsed + 1)) };
}

// ── Metrics per variant ─────────────────────────────────────────────────────

export type VariantHistory = {
  variantKey: string;
  productKey: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  ean: string | null;
  options: Record<string, string>;
  channels: string[];
  price: number | null;
  unitCost: number | null;
  stock: number | null;
  firstSeenDay: string;
  /** Units sold per day, all channels together. */
  sales: Map<string, number>;
  revenue: Map<string, number>;
  /** End-of-day stock; days without a value are unknown. */
  stockByDay: Map<string, number>;
  /** Ordered but not yet delivered. */
  incoming: number;
  returns: { units: number; reasons: Record<string, number> };
};

export type VariantStatus = "out_of_stock" | "low" | "dead" | "slow" | "healthy" | "new" | "inactive" | "untracked";

export type VariantMetrics = {
  variantKey: string;
  productKey: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  ean: string | null;
  options: Record<string, string>;
  channels: string[];
  price: number | null;
  unitCost: number | null;
  stock: number | null;
  incoming: number;
  sold7: number;
  sold30: number;
  sold90: number;
  sold365: number;
  revenue90: number;
  inStockDays: number;
  /** Units per week while in stock. */
  velocityPerWeek: number;
  velocityBasis: "variant" | "product_curve" | "long_window";
  daysOfStock: number | null;
  seasonFactor: number;
  status: VariantStatus;
  recommendedOrder: number;
  stockValue: number | null;
  stockValueBasis: "cost" | "price" | null;
  lastSaleDay: string | null;
  returns: { units: number; topReason: string | null; topReasonCount: number };
  /** Support conversations about this variant in the last 90 days (lib/inventory/questionsCore.ts). */
  questions?: { total: number; topics: Partial<Record<string, number>>; topTopic: string | null };
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function sumWindow(series: Map<string, number>, today: string, days: number, offset = 0) {
  let total = 0;
  for (let index = 0; index < days; index += 1) total += series.get(addDays(today, -(offset + index))) ?? 0;
  return total;
}

function lastSale(series: Map<string, number>) {
  let latest: string | null = null;
  for (const [day, units] of series) if (units > 0 && (!latest || day > latest)) latest = day;
  return latest;
}

/** Days in the speed window the variant could be bought: known stock above zero, or a sale that day. */
function inStockDays(history: VariantHistory, today: string) {
  if (!history.stockByDay.size) return VELOCITY_WINDOW_DAYS;
  let days = 0;
  for (let index = 0; index < VELOCITY_WINDOW_DAYS; index += 1) {
    const day = addDays(today, -index);
    if (day < history.firstSeenDay) break;
    const stock = history.stockByDay.get(day);
    if (stock === undefined || stock > 0 || (history.sales.get(day) ?? 0) > 0) days += 1;
  }
  return days;
}

export function demandDays(settings: InventorySettings) {
  return settings.leadTimeDays + settings.coverWeeks * 7;
}

/**
 * Last year's change from "the 8 weeks before now" to "the coming period",
 * per product: a product that tripled in Q4 last year gets a factor of about
 * 3 before Q4. 1 without a full year of history (counted from `firstDay`) or
 * with too few sales.
 */
export function seasonFactor(sales: Map<string, number>, today: string, horizonDays: number, firstDay?: string) {
  const windowStart = addDays(today, -365);
  if (firstDay && firstDay > addDays(windowStart, -VELOCITY_WINDOW_DAYS)) return 1;
  let coming = 0;
  for (let index = 0; index < horizonDays; index += 1) coming += sales.get(addDays(windowStart, index)) ?? 0;
  const before = sumWindow(sales, addDays(windowStart, -1), VELOCITY_WINDOW_DAYS);
  if (before < PRODUCT_CURVE_MIN_UNITS && coming < PRODUCT_CURVE_MIN_UNITS) return 1;
  if (before <= 0) return 1;
  const factor = (coming / horizonDays) / (before / VELOCITY_WINDOW_DAYS);
  return Math.min(4, Math.max(0.25, round2(factor)));
}

function statusFor(input: { stock: number | null; velocityPerWeek: number; sold90: number; daysOfStock: number | null; historyDays: number; soldRecently: number }, settings: InventorySettings): VariantStatus {
  if (input.stock == null) return "untracked";
  if (input.stock <= 0) return input.velocityPerWeek > 0 || input.sold90 > 0 ? "out_of_stock" : "inactive";
  if (input.historyDays >= settings.deadAfterDays && input.soldRecently === 0) return "dead";
  if (input.daysOfStock != null && input.daysOfStock > settings.deadCoverWeeks * 7) return input.historyDays < NEW_VARIANT_DAYS ? "new" : "dead";
  if (input.daysOfStock != null && input.daysOfStock <= settings.leadTimeDays + 7) return "low";
  if (input.historyDays < NEW_VARIANT_DAYS) return "new";
  if (input.daysOfStock != null && input.daysOfStock > settings.coverWeeks * 7 * 2) return "slow";
  return "healthy";
}

function orderQuantity(velocityPerWeek: number, factor: number, stock: number | null, incoming: number, settings: InventorySettings) {
  const expected = (velocityPerWeek / 7) * demandDays(settings) * factor;
  return Math.max(0, Math.ceil(expected * (1 + settings.safetyBuffer) - Math.max(0, stock ?? 0) - incoming));
}

function finish(base: Omit<VariantMetrics, "daysOfStock" | "status" | "recommendedOrder">, historyDays: number, soldRecently: number, settings: InventorySettings): VariantMetrics {
  // Looking ahead: before a busy season the same stock lasts shorter.
  const perDay = (base.velocityPerWeek / 7) * base.seasonFactor;
  const daysOfStock = base.stock == null ? null : base.stock <= 0 ? 0 : perDay > 0 ? round2(base.stock / perDay) : null;
  const status = statusFor({ stock: base.stock, velocityPerWeek: base.velocityPerWeek, sold90: base.sold90, daysOfStock: daysOfStock ?? (base.stock && base.stock > 0 ? Infinity : null), historyDays, soldRecently }, settings);
  const buys = status !== "dead" && status !== "slow" && status !== "inactive" && status !== "untracked";
  return {
    ...base,
    daysOfStock,
    status,
    recommendedOrder: buys ? orderQuantity(base.velocityPerWeek, base.seasonFactor, base.stock, base.incoming, settings) : 0,
  };
}

export function computeVariantMetrics(history: VariantHistory, settings: InventorySettings, today: string, productSeasonFactor = 1): VariantMetrics {
  const sold7 = sumWindow(history.sales, today, 7);
  const sold30 = sumWindow(history.sales, today, 30);
  const sold90 = sumWindow(history.sales, today, 90);
  const sold365 = sumWindow(history.sales, today, 365);
  const soldWindow = sumWindow(history.sales, today, VELOCITY_WINDOW_DAYS);
  const historyDays = Math.max(1, daysBetween(history.firstSeenDay, today) + 1);
  const available = inStockDays(history, today);
  const windowDays = Math.min(VELOCITY_WINDOW_DAYS, historyDays);
  let velocityPerWeek: number;
  let velocityBasis: VariantMetrics["velocityBasis"] = "variant";
  if (available >= Math.min(MIN_IN_STOCK_DAYS, windowDays)) {
    velocityPerWeek = (soldWindow / Math.max(1, Math.min(available, windowDays))) * 7;
  } else {
    // Mostly sold out lately: fall back to the longer window.
    velocityPerWeek = (sold90 / Math.max(1, Math.min(90, historyDays))) * 7;
    velocityBasis = "long_window";
  }
  const reasons = Object.entries(history.returns.reasons).sort((a, b) => b[1] - a[1]);
  const valueBasis = history.unitCost != null ? "cost" : history.price != null ? "price" : null;
  const unitValue = history.unitCost ?? history.price;
  return finish({
    variantKey: history.variantKey,
    productKey: history.productKey,
    productTitle: history.productTitle,
    variantTitle: history.variantTitle,
    sku: history.sku,
    ean: history.ean,
    options: history.options,
    channels: history.channels,
    price: history.price,
    unitCost: history.unitCost,
    stock: history.stock,
    incoming: history.incoming,
    sold7,
    sold30,
    sold90,
    sold365,
    revenue90: round2(sumWindow(history.revenue, today, 90)),
    inStockDays: available,
    velocityPerWeek: round2(velocityPerWeek),
    velocityBasis,
    seasonFactor: productSeasonFactor,
    stockValue: history.stock != null && history.stock > 0 && unitValue != null ? round2(history.stock * unitValue) : null,
    stockValueBasis: history.stock != null && history.stock > 0 ? valueBasis : null,
    lastSaleDay: lastSale(history.sales),
    returns: { units: history.returns.units, topReason: reasons[0]?.[0] ?? null, topReasonCount: reasons[0]?.[1] ?? 0 },
  }, historyDays, sumWindow(history.sales, today, settings.deadAfterDays), settings);
}

/**
 * Two or three sales per variant say little. When the product as a whole
 * sells, a quiet variant gets its share of the product's speed by its share of
 * the product's sales over the year (with +1 smoothing per variant).
 */
export function applyProductCurve(metrics: VariantMetrics[], settings: InventorySettings, histories: Map<string, VariantHistory>, today: string) {
  const byProduct = new Map<string, VariantMetrics[]>();
  for (const metric of metrics) byProduct.set(metric.productKey, [...(byProduct.get(metric.productKey) ?? []), metric]);
  const result: VariantMetrics[] = [];
  for (const variants of byProduct.values()) {
    const productSold90 = variants.reduce((sum, variant) => sum + variant.sold90, 0);
    const productSold365 = variants.reduce((sum, variant) => sum + variant.sold365, 0);
    const productVelocity = variants.reduce((sum, variant) => sum + variant.velocityPerWeek, 0);
    for (const variant of variants) {
      const history = histories.get(variant.variantKey);
      if (!history || productSold90 < PRODUCT_CURVE_MIN_UNITS || variant.sold90 >= LOW_VOLUME_UNITS || variant.stock == null) {
        result.push(variant);
        continue;
      }
      const share = (variant.sold365 + 1) / (productSold365 + variants.length);
      const curved = round2(productVelocity * share);
      // Only ever lifts a quiet variant toward its share; a variant that truly stopped selling stays dead.
      if (curved <= variant.velocityPerWeek || variant.sold90 === 0) {
        result.push(variant);
        continue;
      }
      const historyDays = Math.max(1, daysBetween(history.firstSeenDay, today) + 1);
      result.push(finish({ ...variant, velocityPerWeek: curved, velocityBasis: "product_curve" }, historyDays, sumWindow(history.sales, today, settings.deadAfterDays), settings));
    }
  }
  return result;
}

/** Metrics for every variant, with season per product and the product curve applied. */
export function computeInventoryMetrics(histories: VariantHistory[], settings: InventorySettings, today: string) {
  const productSales = new Map<string, Map<string, number>>();
  const productFirstDay = new Map<string, string>();
  for (const history of histories) {
    const first = productFirstDay.get(history.productKey);
    if (!first || history.firstSeenDay < first) productFirstDay.set(history.productKey, history.firstSeenDay);
    const series = productSales.get(history.productKey) ?? new Map<string, number>();
    for (const [day, units] of history.sales) series.set(day, (series.get(day) ?? 0) + units);
    productSales.set(history.productKey, series);
  }
  const factors = new Map<string, number>();
  for (const [productKey, series] of productSales) factors.set(productKey, seasonFactor(series, today, demandDays(settings), productFirstDay.get(productKey)));
  const byKey = new Map(histories.map((history) => [history.variantKey, history]));
  const metrics = histories.map((history) => computeVariantMetrics(history, settings, today, factors.get(history.productKey) ?? 1));
  return applyProductCurve(metrics, settings, byKey, today);
}

// ── Summary and actions ─────────────────────────────────────────────────────

export type InventorySummary = {
  variants: number;
  trackedVariants: number;
  deadVariants: number;
  deadStockValue: number;
  deadStockUnits: number;
  lowVariants: number;
  outOfStockVariants: number;
  toOrderVariants: number;
  toOrderUnits: number;
  stockValue: number;
};

export function summarize(metrics: VariantMetrics[]): InventorySummary {
  const dead = metrics.filter((metric) => metric.status === "dead");
  const toOrder = metrics.filter((metric) => metric.recommendedOrder > 0);
  return {
    variants: metrics.length,
    trackedVariants: metrics.filter((metric) => metric.stock != null).length,
    deadVariants: dead.length,
    deadStockValue: round2(dead.reduce((sum, metric) => sum + (metric.stockValue ?? 0), 0)),
    deadStockUnits: dead.reduce((sum, metric) => sum + Math.max(0, metric.stock ?? 0), 0),
    lowVariants: metrics.filter((metric) => metric.status === "low").length,
    outOfStockVariants: metrics.filter((metric) => metric.status === "out_of_stock").length,
    toOrderVariants: toOrder.length,
    toOrderUnits: toOrder.reduce((sum, metric) => sum + metric.recommendedOrder, 0),
    stockValue: round2(metrics.reduce((sum, metric) => sum + (metric.stockValue ?? 0), 0)),
  };
}

export type InventoryActionKind = "stop_buying" | "reorder_now" | "restock_sold_out" | "season_up";

export type InventoryAction = {
  kind: InventoryActionKind;
  variantKey: string;
  title: string;
  text: string;
  /** Euros at stake: money stuck in stock, or sales lost while sold out over the lead time. */
  impact: number;
  quantity: number | null;
};

type Language = "nl" | "en";

const money = (value: number, language: Language) =>
  new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const amount = (value: number, language: Language, digits = 0) =>
  new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: digits }).format(value);

export function variantLabel(metric: Pick<VariantMetrics, "productTitle" | "variantTitle">) {
  return metric.variantTitle && metric.variantTitle.toLowerCase() !== "default title" ? `${metric.productTitle} · ${metric.variantTitle}` : metric.productTitle;
}

function returnNote(metric: VariantMetrics, language: Language) {
  if (metric.returns.topReasonCount < 2 || !metric.returns.topReason) return "";
  return language === "nl"
    ? ` ${metric.returns.topReasonCount} retouren met reden "${metric.returns.topReason}".`
    : ` ${metric.returns.topReasonCount} returns with reason "${metric.returns.topReason}".`;
}

/**
 * What to do this week, most money at stake first, but no single kind fills
 * more than half the list: a pile of dead stock must not hide what to reorder.
 * Every sentence carries its own numbers.
 */
export function buildActions(metrics: VariantMetrics[], settings: InventorySettings, language: Language, limit = 10): InventoryAction[] {
  const nl = language === "nl";
  const actions: InventoryAction[] = [];
  for (const metric of metrics) {
    const label = variantLabel(metric);
    const price = metric.price ?? 0;
    const weeks = metric.daysOfStock == null ? null : Math.round(metric.daysOfStock / 7);
    if (metric.status === "dead" && (metric.stock ?? 0) > 0) {
      const value = metric.stockValue ?? 0;
      const stuck = value > 0 ? (nl ? ` Er staat ${money(value, language)} vast.` : ` ${money(value, language)} is tied up.`) : "";
      const pace = metric.sold90 === 0
        ? (nl ? `niets verkocht in ${settings.deadAfterDays} dagen` : `nothing sold in ${settings.deadAfterDays} days`)
        : (nl ? `${metric.sold90} verkocht in 90 dagen, genoeg voor ${weeks ?? "∞"} weken` : `${metric.sold90} sold in 90 days, enough for ${weeks ?? "∞"} weeks`);
      actions.push({
        kind: "stop_buying",
        variantKey: metric.variantKey,
        title: nl ? `Niet bijkopen: ${label}` : `Do not reorder: ${label}`,
        text: (nl ? `${metric.stock} op voorraad, ${pace}.` : `${metric.stock} in stock, ${pace}.`) + stuck + returnNote(metric, language),
        impact: value,
        quantity: 0,
      });
    } else if (metric.status === "out_of_stock" && metric.velocityPerWeek > 0) {
      const lost = metric.velocityPerWeek * price * (settings.leadTimeDays / 7);
      actions.push({
        kind: "restock_sold_out",
        variantKey: metric.variantKey,
        title: nl ? `Uitverkocht: ${label}` : `Sold out: ${label}`,
        text: nl
          ? `Verkocht ongeveer ${amount(metric.velocityPerWeek, language, 1)} per week toen hij op voorraad was. Bestel ${metric.recommendedOrder} stuks.${lost > 0 ? ` Tot de levering mis je zo'n ${money(lost, language)} omzet.` : ""}`
          : `Sold about ${amount(metric.velocityPerWeek, language, 1)} a week while in stock. Order ${metric.recommendedOrder}.${lost > 0 ? ` Until delivery you miss about ${money(lost, language)} in sales.` : ""}`,
        impact: lost,
        quantity: metric.recommendedOrder,
      });
    } else if (metric.status === "low" && metric.recommendedOrder > 0) {
      const days = Math.max(0, Math.floor(metric.daysOfStock ?? 0));
      const shortDays = Math.max(0, settings.leadTimeDays - days);
      const lost = (metric.velocityPerWeek / 7) * shortDays * price;
      const when = days <= 1
        ? (nl ? `Nog maar ${metric.stock} op voorraad` : `Only ${metric.stock} left`)
        : (nl ? `Over ${days} dagen op` : `Runs out in ${days} days`);
      actions.push({
        kind: "reorder_now",
        variantKey: metric.variantKey,
        title: nl ? `Nu bestellen: ${label}` : `Order now: ${label}`,
        text: nl
          ? `${when} bij ${amount(metric.velocityPerWeek, language, 1)} per week; je levertijd is ${settings.leadTimeDays} dagen. Bestel ${metric.recommendedOrder} stuks.${metric.seasonFactor >= 1.3 ? ` Vorig jaar verkocht dit product in deze periode ${amount(metric.seasonFactor, language, 1)}× zo veel.` : ""}`
          : `${when} at ${amount(metric.velocityPerWeek, language, 1)} a week; your lead time is ${settings.leadTimeDays} days. Order ${metric.recommendedOrder}.${metric.seasonFactor >= 1.3 ? ` Last year this product sold ${amount(metric.seasonFactor, language, 1)}× as much in this period.` : ""}`,
        impact: Math.max(lost, metric.recommendedOrder * price * 0.05),
        quantity: metric.recommendedOrder,
      });
    } else if (metric.status === "healthy" && metric.seasonFactor >= 1.5 && metric.recommendedOrder > 0) {
      actions.push({
        kind: "season_up",
        variantKey: metric.variantKey,
        title: nl ? `Seizoen komt eraan: ${label}` : `Season ahead: ${label}`,
        text: nl
          ? `Vorig jaar verkocht dit product in de komende ${Math.round(demandDays(settings) / 7)} weken ${amount(metric.seasonFactor, language, 1)}× zo veel als ervoor. Bestel ${metric.recommendedOrder} stuks.`
          : `Last year this product sold ${amount(metric.seasonFactor, language, 1)}× as much in the coming ${Math.round(demandDays(settings) / 7)} weeks. Order ${metric.recommendedOrder}.`,
        impact: metric.recommendedOrder * price * 0.1,
        quantity: metric.recommendedOrder,
      });
    }
  }
  const sorted = actions.sort((a, b) => b.impact - a.impact);
  const perKind = Math.ceil(limit / 2);
  const picked: InventoryAction[] = [];
  const counts = new Map<InventoryActionKind, number>();
  const rest: InventoryAction[] = [];
  for (const action of sorted) {
    if (picked.length >= limit) break;
    const count = counts.get(action.kind) ?? 0;
    if (count >= perKind) {
      rest.push(action);
      continue;
    }
    counts.set(action.kind, count + 1);
    picked.push(action);
  }
  // Fewer kinds than room: fill up with the most valuable of the rest.
  for (const action of rest) {
    if (picked.length >= limit) break;
    picked.push(action);
  }
  return picked.sort((a, b) => b.impact - a.impact);
}

// ── Season report ───────────────────────────────────────────────────────────

export type SeasonRow = { variantKey: string; label: string; productTitle: string; units: number; revenue: number; stock: number | null };

/** What sold in a period one year earlier: best products, best and worst variants. */
export function seasonReport(histories: VariantHistory[], from: string, to: string, limit = 10) {
  const lastYearFrom = addDays(from, -365);
  const span = Math.max(0, daysBetween(from, to));
  const rows: SeasonRow[] = histories.map((history) => {
    let units = 0;
    let revenue = 0;
    for (let index = 0; index <= span; index += 1) {
      const day = addDays(lastYearFrom, index);
      units += history.sales.get(day) ?? 0;
      revenue += history.revenue.get(day) ?? 0;
    }
    return { variantKey: history.variantKey, label: variantLabel(history), productTitle: history.productTitle, units, revenue: round2(revenue), stock: history.stock };
  });
  const products = new Map<string, { productTitle: string; units: number; revenue: number }>();
  for (const row of rows) {
    const product = products.get(row.productTitle) ?? { productTitle: row.productTitle, units: 0, revenue: 0 };
    product.units += row.units;
    product.revenue = round2(product.revenue + row.revenue);
    products.set(row.productTitle, product);
  }
  const sold = rows.filter((row) => row.units > 0).sort((a, b) => b.units - a.units);
  return {
    from: lastYearFrom,
    to: addDays(lastYearFrom, span),
    hasHistory: sold.length > 0,
    totalUnits: rows.reduce((sum, row) => sum + row.units, 0),
    topProducts: [...products.values()].filter((product) => product.units > 0).sort((a, b) => b.units - a.units).slice(0, limit),
    topVariants: sold.slice(0, limit),
    // Variants with stock now that hardly sold in that period last year.
    weakVariants: rows.filter((row) => (row.stock ?? 0) > 0).sort((a, b) => a.units - b.units || (b.stock ?? 0) - (a.stock ?? 0)).slice(0, limit),
  };
}

// ── CSV import ──────────────────────────────────────────────────────────────

export type ImportKind = "sales" | "deliveries";
export type ImportRow = { day: string; sku: string | null; ean: string | null; quantity: number; amount: number | null };

const HEADER_ALIASES: Record<keyof Omit<ImportRow, "day"> | "day", string[]> = {
  day: ["date", "datum", "day", "dag", "received_on", "geleverd", "leverdatum"],
  sku: ["sku", "artikelnummer", "artikelcode", "productcode", "variant sku"],
  ean: ["ean", "barcode", "gtin"],
  quantity: ["quantity", "aantal", "qty", "units", "stuks", "verkocht"],
  amount: ["revenue", "omzet", "amount", "bedrag", "unit_cost", "inkoopprijs", "kostprijs"],
};

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseDay(value: string) {
  const trimmed = value.trim();
  if (isDay(trimmed)) return trimmed;
  const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const day = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return isDay(day) ? day : null;
}

function parseNumber(value: string) {
  const cleaned = value.replace(/[€\s]/g, "");
  if (!cleaned) return null;
  // "1.234,56" (nl) and "1,234.56" (en) both read correctly.
  const normalized = cleaned.includes(",") && (!cleaned.includes(".") || cleaned.lastIndexOf(",") > cleaned.lastIndexOf("."))
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export const IMPORT_MAX_ROWS = 50_000;

/** Reads a sales history or deliveries CSV (comma or semicolon, nl or en headers). */
export function parseInventoryCsv(text: string, today: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { rows: [] as ImportRow[], errors: ["Het bestand is leeg."] };
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitCsvLine(lines[0], delimiter).map((cell) => cell.toLowerCase().replace(/"/g, "").trim());
  const column = (field: keyof typeof HEADER_ALIASES) => header.findIndex((cell) => HEADER_ALIASES[field].includes(cell));
  const columns = { day: column("day"), sku: column("sku"), ean: column("ean"), quantity: column("quantity"), amount: column("amount") };
  const errors: string[] = [];
  if (columns.day < 0) errors.push("Kolom met de datum ontbreekt (date of datum).");
  if (columns.quantity < 0) errors.push("Kolom met het aantal ontbreekt (quantity of aantal).");
  if (columns.sku < 0 && columns.ean < 0) errors.push("Kolom met SKU of EAN ontbreekt.");
  if (errors.length) return { rows: [] as ImportRow[], errors };
  if (lines.length - 1 > IMPORT_MAX_ROWS) return { rows: [] as ImportRow[], errors: [`Maximaal ${IMPORT_MAX_ROWS} regels per bestand.`] };

  const rows: ImportRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitCsvLine(lines[index], delimiter);
    const line = index + 1;
    const day = parseDay(cells[columns.day] ?? "");
    const quantity = parseNumber(cells[columns.quantity] ?? "");
    const sku = columns.sku >= 0 ? normalizeSku(cells[columns.sku]) : null;
    const ean = columns.ean >= 0 ? normalizeEan(cells[columns.ean]) : null;
    if (!day) { errors.push(`Regel ${line}: datum niet herkend.`); continue; }
    if (day > addDays(today, 366)) { errors.push(`Regel ${line}: datum ligt te ver in de toekomst.`); continue; }
    if (quantity == null || !Number.isInteger(quantity) || quantity <= 0) { errors.push(`Regel ${line}: aantal moet een heel getal boven 0 zijn.`); continue; }
    if (!sku && !ean) { errors.push(`Regel ${line}: SKU of EAN ontbreekt.`); continue; }
    rows.push({ day, sku, ean, quantity, amount: columns.amount >= 0 ? parseNumber(cells[columns.amount] ?? "") : null });
    if (errors.length > 50) break;
  }
  return { rows, errors: errors.slice(0, 50) };
}
