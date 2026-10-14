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

test("link intents: only long random tokens are accepted, and their hash differs from a code hash", async () => {
  const { isShopifyLinkIntent, hashShopifyLinkIntent, hashShopifyLinkCode } = await import("../lib/shopify/linkCode.ts");
  const intent = "a".repeat(43);
  assert.equal(isShopifyLinkIntent(intent), true);
  assert.equal(isShopifyLinkIntent("short"), false);
  assert.equal(isShopifyLinkIntent("x".repeat(43) + "/"), false);
  assert.equal(isShopifyLinkIntent(undefined), false);
  assert.match(hashShopifyLinkIntent(intent), /^[0-9a-f]{64}$/);
  assert.notEqual(hashShopifyLinkIntent(intent), hashShopifyLinkCode("K7PM-3QXR"));
  assert.throws(() => hashShopifyLinkIntent("nope"));
});

test("one login, one workspace: sign-in linking, and moving an installed shop", async () => {
  const { readFileSync } = await import("node:fs");
  const route = readFileSync(new URL("../app/api/shopify/workspace/route.ts", import.meta.url), "utf8");
  assert.match(route, /body\.mode === "claim"/);
  assert.match(route, /if \(!codeHash\) return NextResponse\.json\(\{ pending: true \}/);
  const installs = readFileSync(new URL("../lib/shopify/installations.ts", import.meta.url), "utf8");
  assert.match(installs, /if \(install\?\.tenant_id\) fn = "relink_shopify_tenant"/);
  const migration = readFileSync(new URL("../supabase/migrations/051_shopify_relink.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE FUNCTION relink_shopify_tenant/);
  assert.match(migration, /RAISE EXCEPTION 'This workspace is already linked to a Shopify shop'/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION relink_shopify_tenant\(text,text,text,text\) TO service_role/);
  const linkCode = readFileSync(new URL("../app/api/shopify/link-code/route.ts", import.meta.url), "utf8");
  assert.match(linkCode, /intent_hash: intentHash/);
  const ui = readFileSync(new URL("../components/shopify/EmbeddedSupport.tsx", import.meta.url), "utf8");
  assert.match(ui, /Heb je al een SequenceFlow-account\?/);
  assert.match(ui, /event\.origin !== window\.location\.origin/);
});
