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
test("Shopify trial is based on verified trial expiration", () => {
  assert.equal(resolveShopifySubscription({ ...active, trialEndsAt: "2026-09-27T00:00:00Z" }, "pilot.myshopify.com", handles, now).plan, "trial");
  assert.equal(resolveShopifySubscription({ ...active, trialEndsAt: "2026-09-21T00:00:00Z" }, "pilot.myshopify.com", handles, now).plan, "pro");
});
