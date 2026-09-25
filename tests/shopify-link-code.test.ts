import assert from "node:assert/strict";
import { test } from "node:test";
import { createShopifyLinkCode, hashShopifyLinkCode, normalizeShopifyLinkCode } from "../lib/shopify/linkCode.ts";

test("link codes are 8 unambiguous characters in two groups", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = createShopifyLinkCode();
    assert.match(code, /^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
    assert.equal(normalizeShopifyLinkCode(code), code);
  }
});

test("what people type is normalised before hashing", () => {
  assert.equal(normalizeShopifyLinkCode(" k7pm 3qxr "), "K7PM-3QXR");
  assert.equal(hashShopifyLinkCode("k7pm3qxr"), hashShopifyLinkCode("K7PM-3QXR"));
});

test("malformed or ambiguous codes are rejected", () => {
  assert.equal(normalizeShopifyLinkCode("K7PM-3QX"), null);
  assert.equal(normalizeShopifyLinkCode("K7PM-3QX0"), null);
  assert.equal(normalizeShopifyLinkCode("K7PM-3QXI"), null);
  assert.throws(() => hashShopifyLinkCode("nope"));
});
