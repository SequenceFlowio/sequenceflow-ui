import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_INVENTORY_SETTINGS,
  addDays,
  aggregateDailySales,
  buildActions,
  combineStock,
  computeInventoryMetrics,
  createVariantResolver,
  daysBetween,
  detectDeliveries,
  parseInventoryCsv,
  seasonFactor,
  seasonReport,
  sellThrough,
  shopDay,
  summarize,
  variantKeyFor,
  type VariantHistory,
} from "../lib/inventory/core.ts";

const today = "2026-10-28";
const settings = DEFAULT_INVENTORY_SETTINGS;

/** A variant with `perWeek` sales spread evenly over `days` days, ending today. */
function history(input: Partial<VariantHistory> & { variantKey: string; perDay?: (day: string, index: number) => number; days?: number }): VariantHistory {
  const sales = new Map<string, number>();
  const revenue = new Map<string, number>();
  const days = input.days ?? 400;
  for (let index = 0; index < days; index += 1) {
    const day = addDays(today, -index);
    const units = input.perDay ? input.perDay(day, index) : 0;
    if (units > 0) {
      sales.set(day, units);
      revenue.set(day, units * (input.price ?? 20));
    }
  }
  return {
    productKey: "product-c",
    productTitle: "Product C",
    variantTitle: null,
    sku: null,
    ean: null,
    options: {},
    channels: ["shopify"],
    price: 20,
    unitCost: 8,
    stock: 10,
    firstSeenDay: addDays(today, -(days - 1)),
    sales,
    revenue,
    stockByDay: new Map(),
    incoming: 0,
    returns: { units: 0, reasons: {} },
    ...input,
  };
}

/** Every `every` days one sale, so the rate is 1/every per day. */
const steady = (every: number) => (_day: string, index: number) => index % every === 0 ? 1 : 0;

test("days follow the shop's calendar in Amsterdam", () => {
  assert.equal(shopDay("2026-10-27T23:30:00Z"), "2026-10-28");
  assert.equal(shopDay("2026-07-01T21:59:00Z"), "2026-07-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(daysBetween("2026-10-01", "2026-10-28"), 27);
});

test("one variant key per variant, shared across channels by SKU or EAN", () => {
  assert.equal(variantKeyFor({ sku: " ab-12 ", ean: "8712345678906" }), "sku:AB-12");
  assert.equal(variantKeyFor({ ean: "871 2345 678906" }), "ean:8712345678906");
  assert.equal(variantKeyFor({ provider: "shopify", externalId: "gid://shopify/ProductVariant/1" }), "shopify:gid://shopify/ProductVariant/1");
  assert.equal(variantKeyFor({ title: "Sneaker  C", variantTitle: "37 / Groen" }), "title:sneaker c|37 / groen");

  const resolve = createVariantResolver([
    { variantKey: "sku:C-37-GROEN", provider: "shopify", externalId: "gid://v/1", sku: "C-37-GROEN", ean: "8712345678906" },
  ]);
  assert.equal(resolve({ provider: "shopify", variantExternalId: "gid://v/1" }), "sku:C-37-GROEN");
  // bol.com only knows the EAN; it still lands on the webshop variant.
  assert.equal(resolve({ provider: "bol", offerExternalId: "offer-9", ean: "8712345678906" }), "sku:C-37-GROEN");
  assert.equal(resolve({ provider: "woocommerce", sku: "c-37-groen" }), "sku:C-37-GROEN");
  assert.equal(resolve({ provider: "bol", ean: "8700000000001" }), "ean:8700000000001");
});

test("daily sales add up per variant, day and channel and skip cancelled orders", () => {
  const resolve = createVariantResolver([]);
  const rows = aggregateDailySales([
    { provider: "shopify", createdAt: "2026-10-27T10:00:00Z", cancelledAt: null, items: [
      { provider: "shopify", sku: "A", quantity: 2, unitPrice: 10 },
      { provider: "shopify", sku: "A", quantity: 1, unitPrice: 10 },
      { provider: "shopify", sku: "B", quantity: 1 },
    ] },
    { provider: "shopify", createdAt: "2026-10-27T15:00:00Z", cancelledAt: null, items: [{ provider: "shopify", sku: "A", quantity: 1, unitPrice: 12 }] },
    { provider: "shopify", createdAt: "2026-10-27T16:00:00Z", cancelledAt: "2026-10-27T17:00:00Z", items: [{ provider: "shopify", sku: "A", quantity: 9 }] },
    { provider: "bol", createdAt: "2026-10-27T16:00:00Z", cancelledAt: null, items: [{ provider: "bol", sku: "A", quantity: 1 }] },
  ], resolve);
  const shopifyA = rows.find((row) => row.variantKey === "sku:A" && row.channel === "shopify")!;
  assert.deepEqual(shopifyA, { variantKey: "sku:A", day: "2026-10-27", channel: "shopify", unitsSold: 4, revenue: 42, orders: 2 });
  assert.equal(rows.find((row) => row.variantKey === "sku:A" && row.channel === "bol")!.unitsSold, 1);
  assert.equal(rows.find((row) => row.variantKey === "sku:B")!.revenue, 0);
});

test("stock is counted once: webshop stock plus bol.com LVB, not bol.com FBR on top", () => {
  const stock = combineStock([
    { variantKey: "k1", provider: "shopify", stock: 10, stockTracked: true, ownWarehouse: true },
    { variantKey: "k1", provider: "bol", stock: 10, stockTracked: true, ownWarehouse: true },
    { variantKey: "k1", provider: "bol", stock: 25, stockTracked: true, ownWarehouse: false },
    { variantKey: "k2", provider: "bol", stock: 7, stockTracked: true, ownWarehouse: true },
    { variantKey: "k3", provider: "woocommerce", stock: null, stockTracked: false, ownWarehouse: true },
    { variantKey: "k4", provider: "shopify", stock: 5, stockTracked: true, ownWarehouse: true, status: "archived" },
  ]);
  assert.equal(stock.get("k1"), 35);
  assert.equal(stock.get("k2"), 7);
  assert.equal(stock.get("k3"), null);
  assert.equal(stock.has("k4"), false);
});

test("Ezra's example: pink 32 is dead stock, green 37 must be reordered", () => {
  const pink = history({ variantKey: "sku:C-32-ROZE", variantTitle: "32 / Roze", stock: 40, perDay: (_day, index) => (index === 20 || index === 80 || index === 110 ? 1 : 0) });
  const green = history({ variantKey: "sku:C-37-GROEN", variantTitle: "37 / Groen", stock: 4, perDay: steady(2) });
  const metrics = computeInventoryMetrics([pink, green], settings, today);
  const pinkMetrics = metrics.find((metric) => metric.variantKey === pink.variantKey)!;
  const greenMetrics = metrics.find((metric) => metric.variantKey === green.variantKey)!;

  assert.equal(pinkMetrics.status, "dead");
  assert.equal(pinkMetrics.recommendedOrder, 0);
  assert.equal(pinkMetrics.stockValue, 320);
  assert.equal(pinkMetrics.stockValueBasis, "cost");

  assert.equal(greenMetrics.status, "low");
  assert.equal(greenMetrics.velocityPerWeek, 3.5);
  // 0.5 a day over 21 + 56 days, +20% buffer, minus the 4 in stock.
  assert.equal(greenMetrics.recommendedOrder, Math.ceil(0.5 * 77 * 1.2 - 4));

  const actions = buildActions(metrics, settings, "nl");
  assert.equal(actions[0].kind, "stop_buying");
  assert.match(actions[0].title, /Niet bijkopen: Product C · 32 \/ Roze/);
  assert.match(actions[0].text, /40 op voorraad/);
  assert.match(actions[0].text, /€\s?320/);
  assert.ok(actions.some((action) => action.kind === "reorder_now" && action.text.includes(`Bestel ${greenMetrics.recommendedOrder} stuks`)));
});

test("sold-out days do not drag the speed down", () => {
  const stockByDay = new Map<string, number>();
  // In stock (and selling 1 a day) for the last 14 days only; sold out the 42 days before.
  for (let index = 0; index < 56; index += 1) stockByDay.set(addDays(today, -index), index < 14 ? 20 : 0);
  const variant = history({ variantKey: "v", stock: 20, stockByDay, perDay: (_day, index) => (index < 14 ? 1 : 0), days: 200 });
  const [metric] = computeInventoryMetrics([variant], settings, today);
  assert.equal(metric.inStockDays, 14);
  assert.equal(metric.velocityPerWeek, 7);
});

test("an out-of-stock seller is flagged with the sales it misses", () => {
  const stockByDay = new Map([[today, 0], [addDays(today, -1), 0]]);
  const variant = history({ variantKey: "v", stock: 0, stockByDay, perDay: steady(1), price: 30 });
  const [metric] = computeInventoryMetrics([variant], settings, today);
  assert.equal(metric.status, "out_of_stock");
  assert.ok(metric.recommendedOrder > 0);
  const [action] = buildActions([metric], settings, "en");
  assert.equal(action.kind, "restock_sold_out");
  assert.match(action.text, /Order \d+/);
});

test("quiet variants of a selling product get their share of the product's speed", () => {
  const big = history({ variantKey: "m", stock: 30, perDay: steady(1) });
  // Sold 2 in 90 days but 30 over the year: a size that sells, just not lately.
  const quiet = history({ variantKey: "xs", stock: 1, perDay: (_day, index) => (index === 10 || index === 50 || (index > 120 && index % 10 === 0) ? 1 : 0) });
  const metrics = computeInventoryMetrics([big, quiet], settings, today);
  const quietMetric = metrics.find((metric) => metric.variantKey === "xs")!;
  assert.equal(quietMetric.velocityBasis, "product_curve");
  assert.ok(quietMetric.velocityPerWeek > 2 * 7 / 90);
  assert.ok(quietMetric.recommendedOrder > 0);
});

test("a variant with nothing sold for months stays dead even inside a selling product", () => {
  const big = history({ variantKey: "m", stock: 30, perDay: steady(1) });
  const stopped = history({ variantKey: "xxl", stock: 12, perDay: (_day, index) => (index > 200 && index % 5 === 0 ? 1 : 0) });
  const metric = computeInventoryMetrics([big, stopped], settings, today).find((item) => item.variantKey === "xxl")!;
  assert.equal(metric.status, "dead");
  assert.equal(metric.recommendedOrder, 0);
});

test("Q4 last year raises the advice and shortens the days of stock before Q4 this year", () => {
  // Last year: 1 a day until the end of October, then 3 a day in Nov-Dec. This year so far: 1 a day.
  const perDay = (day: string) => (day >= "2025-11-01" && day <= "2025-12-31" ? 3 : 1);
  const product = history({ variantKey: "v", stock: 10, perDay, days: 500 });
  const factor = seasonFactor(product.sales, today, settings.leadTimeDays + settings.coverWeeks * 7);
  assert.ok(factor > 2 && factor < 3, `factor ${factor}`);
  const [withSeason] = computeInventoryMetrics([product], settings, today);
  const [withoutSeason] = computeInventoryMetrics([history({ variantKey: "v", stock: 10, perDay: () => 1, days: 300 })], settings, today);
  assert.ok(withSeason.recommendedOrder > withoutSeason.recommendedOrder * 2);
  assert.ok(withSeason.daysOfStock! < withoutSeason.daysOfStock! / 2);
  assert.equal(seasonFactor(new Map(), today, 77), 1);
  // 400 days of steady sales: last year's comparison period is not complete, so no season.
  assert.equal(seasonFactor(history({ variantKey: "s", perDay: steady(2), days: 400 }).sales, today, 77, addDays(today, -399)), 1);
});

test("deliveries are found in stock jumps, returns and corrections are not", () => {
  const stock = new Map([["2026-10-01", 50], ["2026-10-02", 45], ["2026-10-03", 147], ["2026-10-04", 149], ["2026-10-06", 300]]);
  const sales = new Map([["2026-10-02", 5], ["2026-10-03", 3], ["2026-10-04", 0]]);
  assert.deepEqual(detectDeliveries(stock, sales), [{ day: "2026-10-03", quantity: 105 }]);
});

test("sell-through per delivery after 30, 60 and 90 days", () => {
  const sales = new Map<string, number>();
  for (let index = 0; index < 70; index += 1) sales.set(addDays("2026-08-01", index), 1);
  const result = sellThrough({ day: "2026-08-01", quantity: 100, source: "detected" }, sales, "2026-10-15");
  assert.equal(result.after30, 0.3);
  assert.equal(result.after60, 0.6);
  assert.equal(result.after90, null);
  assert.equal(result.soldSince, 70);
});

test("season report shows what sold in the same period last year", () => {
  const winner = history({ variantKey: "w", variantTitle: "M", perDay: (day) => (day >= "2025-11-01" && day <= "2025-12-31" ? 2 : 0), days: 500 });
  const loser = history({ variantKey: "l", variantTitle: "XXL", stock: 25, perDay: (day) => (day === "2025-11-10" ? 1 : 0), days: 500 });
  const report = seasonReport([winner, loser], "2026-11-01", "2026-12-31");
  assert.equal(report.from, "2025-11-01");
  assert.equal(report.topVariants[0].variantKey, "w");
  assert.equal(report.topVariants[0].units, 122);
  assert.equal(report.weakVariants[0].variantKey, "l");
  assert.equal(report.topProducts[0].units, 123);
});

test("CSV import reads Dutch and English files and explains bad rows", () => {
  const nl = parseInventoryCsv("Datum;Artikelnummer;EAN;Aantal;Omzet\n01-11-2025;c-37-groen;;3;\"89,85\"\n2025-11-02;;8712345678906;2;1.234,50\nfoo;x;;1;\n2025-11-03;x;;0;", today);
  assert.deepEqual(nl.rows, [
    { day: "2025-11-01", sku: "C-37-GROEN", ean: null, quantity: 3, amount: 89.85 },
    { day: "2025-11-02", sku: null, ean: "8712345678906", quantity: 2, amount: 1234.5 },
  ]);
  assert.equal(nl.errors.length, 2);
  assert.match(nl.errors[0], /Regel 4: datum/);

  const en = parseInventoryCsv("date,sku,quantity\n2026-11-15,A,10", today);
  assert.equal(en.rows.length, 1);
  assert.match(parseInventoryCsv("sku,quantity\nA,1", today).errors[0], /datum/);
});

test("a shop with 200 products and 4 variants each is analysed quickly and sensibly", () => {
  const histories: VariantHistory[] = [];
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let product = 0; product < 200; product += 1) {
    for (let variant = 0; variant < 4; variant += 1) {
      const rate = random() < 0.15 ? 0 : random() * 1.5;
      histories.push(history({
        variantKey: `sku:P${product}-V${variant}`,
        productKey: `p${product}`,
        productTitle: `Product ${product}`,
        variantTitle: `Maat ${36 + variant}`,
        stock: Math.floor(random() * 60),
        perDay: () => (random() < rate / 2 ? 2 : 0),
        days: 420,
      }));
    }
  }
  const started = performance.now();
  const metrics = computeInventoryMetrics(histories, settings, today);
  const actions = buildActions(metrics, settings, "nl");
  const elapsed = performance.now() - started;
  assert.equal(metrics.length, 800);
  assert.ok(elapsed < 3000, `took ${elapsed}ms`);
  const summary = summarize(metrics);
  assert.ok(summary.deadVariants > 0);
  assert.ok(summary.toOrderVariants > 0);
  assert.equal(actions.length, 10);
  for (let index = 1; index < actions.length; index += 1) assert.ok(actions[index - 1].impact >= actions[index].impact);
  const kinds = new Map<string, number>();
  for (const action of actions) kinds.set(action.kind, (kinds.get(action.kind) ?? 0) + 1);
  assert.ok(kinds.size > 1, "more than one kind of action");
  assert.ok([...kinds.values()].every((count) => count <= 5), "no kind fills more than half");
  for (const metric of metrics) {
    assert.ok(Number.isFinite(metric.velocityPerWeek) && metric.velocityPerWeek >= 0);
    assert.ok(Number.isInteger(metric.recommendedOrder) && metric.recommendedOrder >= 0);
    if (metric.status === "dead") assert.equal(metric.recommendedOrder, 0);
  }
});
