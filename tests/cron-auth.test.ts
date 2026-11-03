import assert from "node:assert/strict";
import test from "node:test";

import { hasValidCronSecret } from "../lib/auth/cron.ts";

const SECRET = "s3cret-value-with-enough-length";

function request(headers: Record<string, string>, url = "https://app.example/api/cron/tick") {
  return new Request(url, { headers });
}

test("accepts the Vercel Cron bearer header", () => {
  assert.equal(hasValidCronSecret(request({ authorization: `Bearer ${SECRET}` }), SECRET), true);
});

test("accepts the x-cron-secret header for manual runs", () => {
  assert.equal(hasValidCronSecret(request({ "x-cron-secret": SECRET }), SECRET), true);
});

test("never accepts the secret in the query string", () => {
  assert.equal(hasValidCronSecret(request({}, `https://app.example/api/cron/tick?secret=${SECRET}`), SECRET), false);
});

test("rejects a wrong, shorter or missing secret and fails closed without configuration", () => {
  assert.equal(hasValidCronSecret(request({ authorization: "Bearer nope" }), SECRET), false);
  assert.equal(hasValidCronSecret(request({ authorization: `Bearer ${SECRET.slice(0, -1)}` }), SECRET), false);
  assert.equal(hasValidCronSecret(request({}), SECRET), false);
  assert.equal(hasValidCronSecret(request({ authorization: `Bearer ${SECRET}` }), undefined), false);
  assert.equal(hasValidCronSecret(request({ authorization: "Bearer " }), ""), false);
});
