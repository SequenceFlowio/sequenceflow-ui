import test from "node:test";
import assert from "node:assert/strict";
import { annualBaseCents, basePriceEnvKey } from "../lib/billingInterval.ts";
import { planFromPriceId } from "../lib/billing/stripeEvents.ts";
import { currentUsagePeriodStart } from "../lib/billingPlans.ts";

test("annual prepayment applies exactly 20% to twelve base fees", () => {
  assert.deepEqual([4700, 14700, 29700].map(annualBaseCents), [45120, 141120, 285120]);
});
test("yearly and monthly prices activate the same feature tier", () => {
  assert.equal(basePriceEnvKey("pro", "year"), "STRIPE_PRICE_PRO_ANNUAL");
  assert.equal(basePriceEnvKey("unknown", "year"), null);
  assert.equal(planFromPriceId("annual_growth", { STRIPE_PRICE_PRO_ANNUAL: "annual_growth" }), "pro");
  assert.equal(planFromPriceId("monthly_growth", { STRIPE_PRICE_PRO: "monthly_growth" }), "pro");
});
test("an annual subscription anchor still renews allowances monthly, clamping short months", () => {
  assert.equal(currentUsagePeriodStart("2026-01-31T12:00:00Z", new Date("2026-02-28T13:00:00Z")), "2026-02-28T12:00:00.000Z");
  assert.equal(currentUsagePeriodStart("2026-01-31T12:00:00Z", new Date("2026-04-01T13:00:00Z")), "2026-03-31T12:00:00.000Z");
});
