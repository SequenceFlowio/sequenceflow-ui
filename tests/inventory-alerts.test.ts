import assert from "node:assert/strict";
import test from "node:test";

import { alertEmail, diffAlerts, evaluateAlerts, normalizeThreshold, type AlertRule } from "../lib/inventory/alertsCore.ts";
import { DEFAULT_INVENTORY_SETTINGS, addDays } from "../lib/inventory/core.ts";
import type { QuestionConversation } from "../lib/inventory/questionsCore.ts";
import { buildReport, type DeliveryRow, type SalesRow, type StockRow, type VariantRow } from "../lib/inventory/reportCore.ts";

const today = "2026-11-02";

type Item = { sku: string; product: string; stock: number; perDay: (ago: number) => number; days?: number; price?: number };

/** A small shop: variants with daily sales `perDay(daysAgo)` and today's stock. */
function shop(items: Item[], extra: { deliveries?: DeliveryRow[]; conversations?: QuestionConversation[] } = {}) {
  const variants: VariantRow[] = [];
  const sales: SalesRow[] = [];
  const stock: StockRow[] = [];
  for (const item of items) {
    const key = `sku:${item.sku}`;
    const days = item.days ?? 400;
    variants.push({
      provider: "shopify", external_id: item.sku, variant_key: key, product_external_id: item.product, product_title: item.product,
      variant_title: item.sku, sku: item.sku, ean: null, options: {}, price: item.price ?? 50, unit_cost: 20, stock: item.stock,
      stock_tracked: true, own_warehouse: true, status: "active", first_seen_at: `${addDays(today, -(days - 1))}T08:00:00Z`,
    });
    for (let ago = 0; ago < days; ago += 1) {
      const units = item.perDay(ago);
      if (units > 0) sales.push({ variant_key: key, day: addDays(today, -ago), channel: "shopify", units_sold: units, revenue: units * (item.price ?? 50) });
    }
    stock.push({ variant_key: key, day: today, stock: item.stock });
  }
  return buildReport({ variants, sales, stock, deliveries: extra.deliveries ?? [], returns: [], conversations: extra.conversations, today, settings: DEFAULT_INVENTORY_SETTINGS, builtAt: `${today}T05:00:00Z` });
}

const rule = (kind: AlertRule["kind"], threshold: number | null = null, scope: Partial<AlertRule> = {}): AlertRule =>
  ({ id: kind, kind, scope: "all", targetKey: null, targetLabel: null, threshold, enabled: true, ...scope });

const daily = (units: number) => () => units;

test("stock below a number, for everything or one variant", () => {
  const report = shop([
    { sku: "A", product: "Hoodie", stock: 4, perDay: daily(1) },
    { sku: "B", product: "Hoodie", stock: 40, perDay: daily(1) },
  ]);
  const all = evaluateAlerts(report, [rule("stock_below", 10)], "nl");
  assert.deepEqual(all.map((alert) => alert.variantKey), ["sku:A"]);
  assert.match(all[0].body, /Nog 4 op voorraad \(je grens is 10\)/);

  const onlyB = evaluateAlerts(report, [rule("stock_below", 50, { scope: "variant", targetKey: "sku:B" })], "nl");
  assert.deepEqual(onlyB.map((alert) => alert.variantKey), ["sku:B"]);
  assert.deepEqual(evaluateAlerts(report, [{ ...rule("stock_below", 10), enabled: false }], "nl"), []);
});

test("sold out only counts while people bought it", () => {
  const report = shop([
    { sku: "A", product: "Hoodie", stock: 0, perDay: (ago) => (ago > 5 ? 1 : 0) },
    { sku: "B", product: "Hoodie", stock: 0, perDay: () => 0 },
  ]);
  const alerts = evaluateAlerts(report, [rule("sold_out")], "nl");
  assert.deepEqual(alerts.map((alert) => alert.variantKey), ["sku:A"]);
  assert.match(alerts[0].title, /^Uitverkocht: /);
});

test("a sales spike is this week against the usual week", () => {
  const report = shop([
    { sku: "A", product: "Sneaker", stock: 60, perDay: (ago) => (ago < 7 ? 3 : 1) },
    { sku: "B", product: "Sneaker", stock: 60, perDay: daily(1) },
  ]);
  const alerts = evaluateAlerts(report, [rule("sales_spike", 2)], "nl");
  assert.deepEqual(alerts.map((alert) => alert.variantKey), ["sku:A"]);
  assert.match(alerts[0].body, /^21 verkocht in 7 dagen, 3× zo veel/);
});

test("customers asking for something that is gone", () => {
  const conversations = Array.from({ length: 4 }, (_, index) => ({ id: `c${index}`, text: "Wanneer is de Hoodie A weer op voorraad?", intent: null, orderVariantKeys: ["sku:A"] }));
  const report = shop([{ sku: "A", product: "Hoodie", stock: 0, perDay: (ago) => (ago > 5 ? 1 : 0) }], { conversations });
  const alerts = evaluateAlerts(report, [rule("questions_on_short", 3)], "nl");
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].body, /^4 klanten vroegen/);
  assert.deepEqual(evaluateAlerts(report, [rule("questions_on_short", 5)], "nl"), []);
});

test("a delivery that did not arrive", () => {
  const late: DeliveryRow = { id: "d1", variant_key: "sku:A", received_on: addDays(today, -5), quantity: 30, source: "manual", note: null };
  const report = shop([{ sku: "A", product: "Hoodie", stock: 3, perDay: daily(1) }], { deliveries: [late] });
  const alerts = evaluateAlerts(report, [rule("delivery_late", 3)], "nl");
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].body, /^30 stuks werden verwacht op .*, 5 dagen geleden/);
  // Once the stock jump is seen, it arrived.
  const arrived = shop([{ sku: "A", product: "Hoodie", stock: 33, perDay: daily(1) }], {
    deliveries: [late, { id: "d2", variant_key: "sku:A", received_on: addDays(today, -4), quantity: 30, source: "detected", note: null }],
  });
  assert.deepEqual(evaluateAlerts(arrived, [rule("delivery_late", 3)], "nl"), []);
});

test("season ahead warns once per season start, only when there is something to order", () => {
  // A winter product: sells only in November to January, two years of history, little stock.
  const winter = (ago: number) => (["11", "12", "01"].includes(addDays(today, -ago).slice(5, 7)) ? 2 : 0);
  const report = shop([{ sku: "P", product: "Parka", stock: 2, perDay: winter, days: 730 }]);
  const metric = report.metrics[0];
  assert.deepEqual(metric.seasonMonths, [1, 11, 12]);
  // 2 November: the season started yesterday, the next start is a year away; with 60 weeks ahead it shows.
  assert.deepEqual(evaluateAlerts(report, [rule("season_ahead", 6)], "nl"), []);
  const alerts = evaluateAlerts(report, [rule("season_ahead", 60)], "nl");
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].fingerprint, /:2027-11-01$/);
});

test("dead stock above an amount is one alert for the whole shop", () => {
  const report = shop([
    { sku: "A", product: "Jurk", stock: 200, perDay: (ago) => (ago > 200 ? 1 : 0), price: 60 },
    { sku: "B", product: "Jurk", stock: 5, perDay: daily(1) },
  ]);
  const alerts = evaluateAlerts(report, [rule("dead_stock_value", 1000)], "nl");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].variantKey, null);
  assert.match(alerts[0].title, /staat vast in dode voorraad$/);
  assert.deepEqual(evaluateAlerts(report, [rule("dead_stock_value", 1_000_000)], "nl"), []);
});

test("open alerts are kept, new ones added and gone ones closed", () => {
  const hits = [{ fingerprint: "a" }, { fingerprint: "b" }].map((hit) => ({ ...hit, ruleId: "r", kind: "sold_out" as const, variantKey: null, title: "", body: "", impact: 0 }));
  const { add, resolve } = diffAlerts([{ id: "1", fingerprint: "a" }, { id: "2", fingerprint: "c" }], hits);
  assert.deepEqual(add.map((alert) => alert.fingerprint), ["b"]);
  assert.deepEqual(resolve, ["2"]);
});

test("thresholds stay within bounds and fall back to the default", () => {
  assert.equal(normalizeThreshold("stock_below", ""), 10);
  assert.equal(normalizeThreshold("stock_below", "25"), 25);
  assert.equal(normalizeThreshold("stock_below", -1), undefined);
  assert.equal(normalizeThreshold("sold_out", 5), null);
});

test("the mail is signed by Vera and lists every alert", () => {
  const mail = alertEmail({ alerts: [{ title: "Uitverkocht: Hoodie · M", body: "Verkocht 9 per week." }], language: "nl", appUrl: "https://app.test", shopName: "Noord" });
  assert.equal(mail.subject, "Vera: 1 ding in je voorraad van Noord");
  assert.match(mail.text, /1\. Uitverkocht: Hoodie · M\n {3}Verkocht 9 per week\./);
  assert.match(mail.text, /https:\/\/app\.test\/inventory/);
  assert.match(mail.text, /\nVera\n/);
});

test("back in stock: a recent delivery, stock now, and customers who asked when it would be back", () => {
  const conversations = Array.from({ length: 3 }, (_, index) => ({ id: `c${index}`, text: "Wanneer is de Hoodie A weer op voorraad?", intent: null, orderVariantKeys: ["sku:A"] }));
  const deliveries: DeliveryRow[] = [{ id: "d1", variant_key: "sku:A", received_on: addDays(today, -3), quantity: 40, source: "detected", note: null }];
  const report = shop([{ sku: "A", product: "Hoodie", stock: 35, perDay: (ago) => (ago > 5 ? 1 : 0) }, { sku: "B", product: "Hoodie", stock: 35, perDay: daily(1) }], { conversations, deliveries });
  const alerts = evaluateAlerts(report, [rule("back_in_stock", 2)], "nl");
  assert.deepEqual(alerts.map((alert) => alert.variantKey), ["sku:A"]);
  assert.match(alerts[0].title, /^Weer op voorraad: /);
  assert.match(alerts[0].body, /^3 klanten vroegen .* 40 stuks binnen op /);
  assert.equal(alerts[0].fingerprint, "back_in_stock:sku:A:d1");
  // Not yet in stock, or nobody asked: quiet.
  assert.deepEqual(evaluateAlerts(report, [rule("back_in_stock", 5)], "nl"), []);
});

test("low margin and many returns use the unit cost and the returns of the past year", () => {
  const report = shop([
    { sku: "A", product: "Hoodie", stock: 30, perDay: daily(1), price: 25 },
    { sku: "B", product: "Hoodie", stock: 30, perDay: daily(1), price: 100 },
  ]);
  // Unit cost is 20 in the test shop: A earns 20%, B 80%.
  const margin = evaluateAlerts(report, [rule("margin_below", 30)], "nl");
  assert.deepEqual(margin.map((alert) => alert.variantKey), ["sku:A"]);
  assert.match(margin[0].body, /^20% marge \(verkoopprijs €\s25, inkoop €\s20\), onder je grens van 30%/);
  assert.equal(report.metrics.find((metric) => metric.sku === "B")!.marginPct, 80);

  const withReturns = { ...report, metrics: report.metrics.map((metric) => (metric.sku === "A" ? { ...metric, returnRate: 25, returns: { units: 100, topReason: "te klein", topReasonCount: 60 } } : metric)) };
  const returns = evaluateAlerts(withReturns, [rule("returns_above", 20)], "nl");
  assert.deepEqual(returns.map((alert) => alert.variantKey), ["sku:A"]);
  assert.match(returns[0].body, /25% van de \d+ verkochte stuks kwam terug \(100\).*Meest genoemde reden: te klein \(60×\)/);
});
