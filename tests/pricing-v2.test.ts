import assert from "node:assert/strict";
import test from "node:test";

import { cheapestPlan, monthlyEstimate, PLAN_CATALOG_V2 } from "../lib/planCatalog.ts";

test("only conversations above the included number are charged", () => {
  assert.equal(monthlyEstimate(4900, 90, 0, 100).totalCents, 4900);
  assert.equal(monthlyEstimate(4900, 300, 0, 100).totalCents, 4900 + 200 * 47);
  assert.equal(monthlyEstimate(14900, 600, 0, 300).totalCents, 14900 + 300 * 47);
  assert.equal(monthlyEstimate(4900, 0, 200, 100).totalCents, 4900 + 100 * 97);
});

test("a busy store is pointed to the bigger plan once it is cheaper", () => {
  assert.equal(cheapestPlan(250, 0).plan.slug, "starter");
  assert.equal(cheapestPlan(400, 0).plan.slug, "growth");
  assert.equal(cheapestPlan(800, 0).plan.slug, "scale");
  assert.equal(cheapestPlan(150, 150).plan.slug, "growth");
});

test("every plan can send automatically and lists its included conversations", () => {
  assert.deepEqual(PLAN_CATALOG_V2.map((plan) => plan.included), [100, 400, 1000]);
  assert.deepEqual(PLAN_CATALOG_V2.map((plan) => plan.drafts), [500, 2000, 6000]);
  assert.ok(PLAN_CATALOG_V2[0].features.some((feature) => feature.name === "Automatisch versturen"));
});
