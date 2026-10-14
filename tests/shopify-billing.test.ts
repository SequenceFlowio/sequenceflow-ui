import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveShopifySubscription, type ShopifySubscription } from "../lib/shopify/billingState.ts";
const now = Date.parse("2026-09-25T12:00:00Z");
const active: ShopifySubscription = { shop: { id: "gid://shopify/Shop/1", myshopifyDomain: "pilot.myshopify.com" }, trialEndsAt: null, currentBillingCycle: { startTime: "2026-09-20T00:00:00Z", endTime: "2026-10-20T00:00:00Z" }, items: [{ handle: "growth", price: { active: true } }] };
const handles = { growth: "pro" as const };
test("only verified active subscription items grant Shopify plan access", () => {
  assert.equal(resolveShopifySubscription(active, "pilot.myshopify.com", handles, now).plan, "pro");
  assert.equal(resolveShopifySubscription(null, "pilot.myshopify.com", handles, now).plan, "expired");
  assert.throws(() => resolveShopifySubscription(active, "other.myshopify.com", handles, now));
  assert.throws(() => resolveShopifySubscription(active, "pilot.myshopify.com", {}, now));
  assert.throws(() => resolveShopifySubscription({ ...active, items: [] }, "pilot.myshopify.com", handles, now));
  assert.throws(() => resolveShopifySubscription(active, "pilot.myshopify.com", handles, Date.parse("2027-01-01")));
});
test("a trial without a billing cycle still grants access", () => {
  const trial = resolveShopifySubscription({ ...active, trialEndsAt: "2026-09-30T00:00:00Z", currentBillingCycle: null }, "pilot.myshopify.com", handles, now);
  assert.equal(trial.plan, "trial");
  assert.equal(trial.trialEndsAt, "2026-09-30T00:00:00Z");
  assert.equal(trial.billingPeriodStart, "2026-09-23T00:00:00.000Z");
  assert.throws(() => resolveShopifySubscription({ ...active, currentBillingCycle: null }, "pilot.myshopify.com", handles, now));
});
test("a subscription on an older list price keeps its plan", () => {
  assert.equal(resolveShopifySubscription({ ...active, items: [{ handle: "growth", price: { active: false } }] }, "pilot.myshopify.com", handles, now).plan, "pro");
});
test("an unknown plan names the handle it got", () => {
  assert.throws(() => resolveShopifySubscription({ ...active, items: [{ handle: "growth-v2", price: { active: true } }] }, "pilot.myshopify.com", handles, now), /growth-v2/);
});
test("Shopify trial is based on verified trial expiration", () => {
  assert.equal(resolveShopifySubscription({ ...active, trialEndsAt: "2026-09-27T00:00:00Z" }, "pilot.myshopify.com", handles, now).plan, "trial");
  assert.equal(resolveShopifySubscription({ ...active, trialEndsAt: "2026-09-21T00:00:00Z" }, "pilot.myshopify.com", handles, now).plan, "pro");
});

