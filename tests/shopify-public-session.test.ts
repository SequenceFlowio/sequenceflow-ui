import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { verifyShopifySessionToken, verifyShopifyWebhook } from "../lib/shopify/sessionToken.ts";
import { requestShopifyToken } from "../lib/shopify/tokenExchange.ts";

const credentials = { clientId: "client", secret: "test-secret" };
const claims = { aud: "client", dest: "https://pilot.myshopify.com", iss: "https://pilot.myshopify.com/admin", sub: "12", sid: "session", iat: 990, nbf: 990, exp: 1060 };
function sign(overrides = {}, alg = "HS256") {
  const content = [ { alg }, { ...claims, ...overrides } ].map(x => Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");
  return `${content}.${createHmac("sha256", credentials.secret).update(content).digest("base64url")}`;
}
test("Shopify identity is derived only from verified claims", () => {
  assert.deepEqual(verifyShopifySessionToken(sign(), credentials, 1000), { shop: "pilot.myshopify.com", subject: "12", sessionId: "session" });
  for (const override of [{ aud: "other" }, { exp: 1000 }, { nbf: 1001 }, { iat: 1001 }, { sub: null }, { sid: "" }, { iss: "https://other.myshopify.com/admin" }, { dest: "https://pilot.myshopify.com.evil.test" }, { dest: "http://pilot.myshopify.com" }]) {
    assert.throws(() => verifyShopifySessionToken(sign(override), credentials, 1000));
  }
  assert.throws(() => verifyShopifySessionToken(sign({}, "none"), credentials, 1000));
  assert.throws(() => verifyShopifySessionToken(sign().slice(0, -8), credentials, 1000));
});
test("webhook signature covers exact raw body", () => {
  const body = Buffer.from('{"id":1}');
  const hmac = createHmac("sha256", credentials.secret).update(body).digest("base64");
  assert.equal(verifyShopifyWebhook(body, hmac, credentials.secret), true);
  assert.equal(verifyShopifyWebhook(Buffer.from('{"id":2}'), hmac, credentials.secret), false);
  assert.equal(verifyShopifyWebhook(body, "", credentials.secret), false);
});
test("offline exchange requests expiring read-only tokens and rejects expanded scopes", async () => {
  let body: URLSearchParams | undefined;
  const request = (async (_url, options) => {
    body = options?.body as URLSearchParams;
    return Response.json({ access_token: "private", scope: "read_orders", expires_in: 3600, refresh_token: "refresh", refresh_token_expires_in: 7776000 });
  }) as typeof fetch;
  await requestShopifyToken("pilot.myshopify.com", credentials, { idToken: "jwt", kind: "offline" }, request);
  assert.equal(body?.get("expiring"), "1");
  assert.equal(body?.get("subject_token"), "jwt");
  await assert.rejects(requestShopifyToken("evil.test", credentials, { idToken: "jwt", kind: "online" }, request));
  await assert.rejects(requestShopifyToken("pilot.myshopify.com", credentials, { idToken: "jwt", kind: "online" }, (async () => Response.json({ access_token: "x", scope: "write_orders", expires_in: 3600 })) as typeof fetch));
});
