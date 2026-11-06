import assert from "node:assert/strict";
import test from "node:test";

import { PLAN_LIMITS } from "../lib/billingPlans.ts";
import { formatPlanPrice, LOWEST_PLAN_PRICE, limitFeatures, PAID_PLAN_CATALOG, planPriceSummary } from "../lib/planCatalog.ts";

test("one price list: summary and lowest price come from the catalog", () => {
  assert.equal(planPriceSummary(), "Starter €79, Growth €229 en Scale €549");
  assert.equal(planPriceSummary("en"), "Starter €79, Growth €229 and Scale €549");
  assert.equal(formatPlanPrice(LOWEST_PLAN_PRICE), "€79");
});

test("what a plan promises matches what the server enforces", () => {
  for (const plan of PAID_PLAN_CATALOG) {
    const limits = PLAN_LIMITS[plan.id];
    assert.match(plan.features.nl[0], new RegExp(`^${limits.aiAnswers.toLocaleString("nl-NL").replace(".", "\\.")} antwoordconcepten`));
    assert.match(plan.features.en[0], new RegExp(`^${limits.aiAnswers.toLocaleString("en-US")} reply drafts`));
  }
  assert.deepEqual(limitFeatures("agency"), ["1.500 antwoordconcepten per maand", "1 supportmailbox", "Onbeperkt teamleden", "Onbeperkt kennisdocumenten"]);
  assert.deepEqual(limitFeatures("trial", "en"), ["150 reply drafts per month", "1 support mailbox", "1 team member", "10 knowledge documents"]);
  assert.deepEqual(PAID_PLAN_CATALOG.map((plan) => plan.slug), ["starter", "growth", "scale"]);
});

test("the new pricing: base + €0,49 checked + €0,99 autonomous, and the price per handled conversation", async () => {
  const { monthlyEstimate, formatCents, HANDLED_RATES } = await import("../lib/planCatalog.ts");
  const { HANDLED_PRICING } = await import("../lib/billing/handledConversations.ts");
  assert.deepEqual(monthlyEstimate(14900, 200, 200), { totalCents: 44500, usageCents: 29600, extra: 400, perHandledCents: 111 });
  const { PLAN_CATALOG_V2 } = await import("../lib/planCatalog.ts");
  // De prijskaart en de teller noemen hetzelfde aantal inbegrepen gesprekken.
  for (const plan of PLAN_CATALOG_V2) assert.equal(plan.included, HANDLED_PRICING.includedPerPeriod[plan.id]);
  assert.equal(formatCents(44500), "€445");
  assert.equal(formatCents(49), "€0,49");
  assert.equal(HANDLED_RATES.assisted, HANDLED_PRICING.rateCents.ai_assisted);
  assert.equal(HANDLED_RATES.autonomous, HANDLED_PRICING.rateCents.ai_autonomous);
});
