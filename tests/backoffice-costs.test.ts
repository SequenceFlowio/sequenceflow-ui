import assert from "node:assert/strict";
import test from "node:test";

import { buildCostReport, eventCostCents, fixedMonthlyCents, operationLabel, stripeFeeCents, UsageTotals, type UsageEvent } from "../lib/backoffice/costs.ts";

const NOW = "2026-11-16T10:00:00.000Z";
const SINCE30 = "2026-10-17T10:00:00.000Z";

const event = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  tenantId: "t1", operation: "decision", model: "gpt-4.1-mini",
  promptTokens: 1_000_000, cachedTokens: 0, completionTokens: 0, createdAt: "2026-11-10T09:00:00.000Z",
  ...overrides,
});

test("one call costs the OpenAI list price, converted to euro cents", () => {
  // 1M input tokens gpt-4.1-mini = $0,40 = €0,368 = 36,8 cent.
  assert.equal(Math.round(eventCostCents(event()) * 10) / 10, 36.8);
  // Cached input is cheaper, output dearer.
  assert.equal(Math.round(eventCostCents(event({ cachedTokens: 1_000_000 })) * 10) / 10, 9.2);
  assert.equal(Math.round(eventCostCents(event({ promptTokens: 0, completionTokens: 1_000_000 })) * 10) / 10, 147.2);
});

test("an unknown model is priced at the dearest known rate, never as free", () => {
  assert.ok(eventCostCents(event({ model: "gpt-9-turbo" })) > eventCostCents(event()));
});

test("Stripe: 2,7% plus 25 cent per paid invoice, nothing without revenue", () => {
  assert.equal(stripeFeeCents(10_000, 2), 320);
  assert.equal(stripeFeeCents(0, 0), 0);
});

test("profit per month subtracts OpenAI, Stripe, fixed costs and ads", () => {
  const totals = new UsageTotals(SINCE30);
  totals.add(event());
  totals.add(event({ createdAt: "2026-10-05T09:00:00.000Z" }));
  const report = buildCostReport({
    now: NOW, totals,
    revenue: [{ month: "2026-10", revenueCents: 50_000, paidInvoices: 5 }, { month: "2026-11", revenueCents: 20_000, paidInvoices: 2 }],
    adsByMonth: { "2026-11": 10_000 },
    tenants: [{ id: "t1", name: "Studio Lume", mrrCents: 4700 }],
  });
  const [october, november] = report.months;
  assert.equal(Math.round(november.openAiCents * 10) / 10, 36.8);
  assert.equal(november.adsCents, 10_000);
  assert.equal(october.adsCents, 0);
  const expected = 20_000 - (36.8 + stripeFeeCents(20_000, 2) + fixedMonthlyCents() + 10_000);
  assert.equal(Math.round(november.profitCents), Math.round(expected));
  assert.equal(report.adsConnected, true);
});

test("without Meta the ad costs are unknown (null), not zero", () => {
  const report = buildCostReport({ now: NOW, totals: new UsageTotals(SINCE30), revenue: [{ month: "2026-11", revenueCents: 0, paidInvoices: 0 }], adsByMonth: null, tenants: [] });
  assert.equal(report.months[0].adsCents, null);
  assert.equal(report.months[0].marginPct, null);
  assert.equal(report.adsConnected, false);
});

test("the last 30 days split per operation, per model and per customer", () => {
  const totals = new UsageTotals(SINCE30);
  totals.add(event());
  totals.add(event({ operation: "customer_gate", tenantId: "t2", promptTokens: 2000 }));
  totals.add(event({ createdAt: "2026-09-01T09:00:00.000Z" })); // ouder dan 30 dagen: alleen in de maand
  const report = buildCostReport({ now: NOW, totals, revenue: [{ month: "2026-11", revenueCents: 0, paidInvoices: 0 }], adsByMonth: null, tenants: [{ id: "t1", name: "Studio Lume", mrrCents: 4700 }] });
  assert.equal(report.last30.calls, 2);
  assert.equal(report.last30.drafts, 1);
  assert.equal(report.operations[0].operation, "decision");
  assert.equal(report.operations[0].label, operationLabel("decision"));
  assert.equal(report.tenants[0].name, "Studio Lume");
  assert.equal(report.tenants[1].name, "t2");
  assert.equal(report.daily.length, 30);
  assert.equal(report.daily.at(-1)!.day, "2026-11-16");
  assert.equal(report.daily.find((point) => point.day === "2026-11-10")!.calls, 2);
});
