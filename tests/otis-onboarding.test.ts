import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAlerts, shopIsQuiet, type AlertRule } from "../lib/inventory/alertsCore.ts";
import { DEFAULT_INVENTORY_SETTINGS, addDays, referenceStock } from "../lib/inventory/core.ts";
import { addNote, parseOnboarding, profileForPrompt, readProfile, suggestedDaysBelow } from "../lib/inventory/otisProfile.ts";
import { buildReport, type SalesRow, type StockRow, type VariantRow } from "../lib/inventory/reportCore.ts";

const today = "2026-11-16";

test("100% is de voorraad na de laatste aanvulling, anders de eerste meting", () => {
  const stock = new Map([["2026-11-01", 50], ["2026-11-02", 45], ["2026-11-03", 40], ["2026-11-04", 90], ["2026-11-05", 80]]);
  const sales = new Map([["2026-11-02", 5], ["2026-11-03", 5], ["2026-11-05", 10]]);
  assert.equal(referenceStock(stock, sales, 80), 90);
  // geen aanvulling: de eerste meting (het moment van koppelen)
  assert.equal(referenceStock(new Map([["2026-11-01", 60], ["2026-11-02", 55]]), new Map([["2026-11-02", 5]]), 55), 60);
  // zonder geschiedenis: wat er nu ligt
  assert.equal(referenceStock(new Map(), new Map(), 12), 12);
  assert.equal(referenceStock(new Map(), new Map(), null), null);
});

test("melding als er minder dan een deel van de laatste levering over is", () => {
  const key = "sku:A";
  const variants: VariantRow[] = [{
    provider: "shopify", external_id: "A", variant_key: key, product_external_id: "Hoodie", product_title: "Hoodie", variant_title: "M",
    sku: "A", ean: null, options: {}, price: 50, unit_cost: 20, stock: 16, stock_tracked: true, own_warehouse: true, status: "active", first_seen_at: `${addDays(today, -60)}T08:00:00Z`,
  }];
  const sales: SalesRow[] = [];
  // Eerst 5 stuks, dan een levering tot 100, daarna 3 per dag verkocht: nu 16 over = 16%.
  const stock: StockRow[] = [{ variant_key: key, day: addDays(today, -29), stock: 5 }];
  for (let ago = 28; ago >= 0; ago -= 1) {
    const day = addDays(today, -ago);
    if (ago < 28) sales.push({ variant_key: key, day, channel: "shopify", units_sold: 3, revenue: 150 });
    stock.push({ variant_key: key, day, stock: 100 - 3 * (28 - ago) });
  }
  const report = buildReport({ variants, sales, stock, deliveries: [], returns: [], today, settings: DEFAULT_INVENTORY_SETTINGS, builtAt: `${today}T05:00:00Z` });
  const rule = (threshold: number): AlertRule => ({ id: "p", kind: "percent_below", scope: "all", targetKey: null, targetLabel: null, threshold, enabled: true });
  const hits = evaluateAlerts(report, [rule(20)], "nl");
  assert.equal(hits.length, 1);
  assert.match(hits[0].body, /16% van de 100 na de laatste levering/);
  assert.equal(evaluateAlerts(report, [rule(10)], "nl").length, 0);
});

test("Otis mailt niet als er al twee weken niets verkocht is", () => {
  assert.equal(shopIsQuiet([{ lastSaleDay: "2026-11-10" }], today), false);
  assert.equal(shopIsQuiet([{ lastSaleDay: "2026-10-20" }, { lastSaleDay: null }], today), true);
  assert.equal(shopIsQuiet([], today), true);
});

test("antwoorden uit de kennismaking worden gecontroleerd", () => {
  const ok = parseOnboarding({ leadTimeDays: 21, coverWeeks: 8, lowStock: { kind: "percent_below", threshold: 20 }, alertEmail: true, weeklyEmail: false, sells: "  dames   kleding ", seasonal: "yes", priority: "never_out" });
  assert.ok(!("error" in ok));
  assert.equal(ok.sells, "dames kleding");
  assert.ok("error" in parseOnboarding({ leadTimeDays: 400, coverWeeks: 8, lowStock: { kind: "days_below", threshold: 10 } }));
  assert.ok("error" in parseOnboarding({ leadTimeDays: 21, coverWeeks: 8, lowStock: { kind: "percent_below", threshold: 100 } }));
  assert.ok("error" in parseOnboarding({ leadTimeDays: 21, coverWeeks: 8, lowStock: { kind: "iets", threshold: 10 } }));
  assert.equal(suggestedDaysBelow(21), 28);
  assert.equal(suggestedDaysBelow(0), 7);
});

test("Otis onthoudt korte feiten, maar geen contact- of bankgegevens", () => {
  const first = addNote({}, "Leverancier Textiel BV levert pas vanaf 50 stuks per kleur");
  assert.ok(!("error" in first));
  const again = addNote(first, "leverancier textiel bv levert pas vanaf 50 stuks per kleur");
  assert.ok(!("error" in again) && again.notes?.length === 1);
  assert.ok("error" in addNote({}, "Mail inkoop@leverancier.nl voor bestellingen"));
  assert.ok("error" in addNote({}, "Betaal naar NL91ABNA0417164300"));
  assert.ok("error" in addNote({}, "ok"));
  const prompt = profileForPrompt(readProfile({ sells: "sneakers", priority: "balanced", notes: [{ text: "Piek in december", at: "x" }] }), true);
  assert.match(prompt, /Sells: sneakers/);
  assert.match(prompt, /Note: Piek in december/);
  assert.equal(profileForPrompt({}, false), "");
});
