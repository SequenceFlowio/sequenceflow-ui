import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";

import { checkoutPlan, invoiceSubscriptionPrice, planFromPriceId, subscriptionPeriodStart } from "../lib/billing/stripeEvents.ts";

const env = { STRIPE_PRICE_STARTER: "price_s", STRIPE_PRICE_PRO: "price_p", STRIPE_PRICE_AGENCY: "price_a" };

test("plan from price id only matches configured prices", () => {
  assert.equal(planFromPriceId("price_p", env), "pro");
  assert.equal(planFromPriceId("price_unknown", env), null);
  assert.equal(planFromPriceId(undefined, env), null);
  assert.equal(planFromPriceId("", { STRIPE_PRICE_STARTER: "" }), null);
});

test("checkout metadata can only set a plan we sell", () => {
  assert.equal(checkoutPlan("agency"), "agency");
  assert.equal(checkoutPlan("custom"), null);
  assert.equal(checkoutPlan("trial"), null);
  assert.equal(checkoutPlan(undefined), null);
});

test("billing period comes from the subscription, with a safe fallback", () => {
  const sub = { items: { data: [{ current_period_start: 1_767_225_600 }] } } as unknown as Stripe.Subscription;
  assert.equal(subscriptionPeriodStart(sub), "2026-01-01T00:00:00.000Z");
  const empty = { items: { data: [] } } as unknown as Stripe.Subscription;
  assert.equal(subscriptionPeriodStart(empty, new Date("2026-11-03T10:00:00Z")), "2026-11-01T00:00:00.000Z");
});

test("invoice price is read from the subscription line, not the first line", () => {
  const invoice = {
    lines: { data: [
      { parent: { type: "invoice_item_details", subscription_item_details: null }, pricing: { price_details: { price: "price_proration" } } },
      { parent: { type: "subscription_item_details", subscription_item_details: { subscription: "sub_1" } }, pricing: { price_details: { price: "price_p" } } },
    ] },
  } as unknown as Stripe.Invoice;
  assert.deepEqual(invoiceSubscriptionPrice(invoice), { priceId: "price_p", subscriptionId: "sub_1" });
  assert.deepEqual(invoiceSubscriptionPrice({ lines: { data: [] } } as unknown as Stripe.Invoice), { priceId: null, subscriptionId: null });
});
