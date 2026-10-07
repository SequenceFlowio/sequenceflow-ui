import assert from "node:assert/strict";
import { test } from "node:test";
import { billingOverrideForShop } from "../lib/shopify/billingOverride.ts";

test("billing overrides: bare shop = trial, shop=plan = that plan, unknown plans are ignored", () => {
  const value = "sequenceflow-test.myshopify.com, guardian-beauty.myshopify.com=pro, x.myshopify.com=gold";
  assert.equal(billingOverrideForShop("sequenceflow-test.myshopify.com", value), "trial");
  assert.equal(billingOverrideForShop("guardian-beauty.myshopify.com", value), "pro");
  assert.equal(billingOverrideForShop("x.myshopify.com", value), null);
  assert.equal(billingOverrideForShop("other.myshopify.com", value), null);
});
