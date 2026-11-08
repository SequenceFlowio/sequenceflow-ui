import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

process.env.CONTENT_SESSION_SECRET = "test-session-secret";
process.env.META_APP_SECRET = "test-app-secret";

const { parseSignedRequest, seal, signState, unseal, verifyState } = await import("../lib/contentCalendar/metaCrypto.ts");

test("tokens are sealed and only readable with the right key", () => {
  const sealed = seal("EAAB-page-token");
  assert.notEqual(sealed, "EAAB-page-token");
  assert.ok(!sealed.includes("EAAB"));
  assert.equal(unseal(sealed), "EAAB-page-token");
  const [iv, tag, data] = sealed.split(".");
  assert.throws(() => unseal([iv, tag, data.slice(0, -2) + "AA"].join(".")));
});

test("Meta's signed_request is verified with the app secret", () => {
  const payload = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "1234" })).toString("base64url");
  const signature = createHmac("sha256", "test-app-secret").update(payload).digest("base64url");
  assert.equal(parseSignedRequest(`${signature}.${payload}`).user_id, "1234");
  const forged = createHmac("sha256", "wrong").update(payload).digest("base64url");
  assert.throws(() => parseSignedRequest(`${forged}.${payload}`));
  assert.throws(() => parseSignedRequest("nonsense"));
});

test("OAuth state only matches its own nonce", () => {
  const state = signState("nonce-1");
  assert.equal(verifyState(state, "nonce-1"), true);
  assert.equal(verifyState(state, "nonce-2"), false);
  assert.equal(verifyState(null, "nonce-1"), false);
  assert.equal(verifyState(state, undefined), false);
});
