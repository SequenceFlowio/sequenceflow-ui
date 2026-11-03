import assert from "node:assert/strict";
import test from "node:test";

import { allowRequest, clientIp, dayKey, rateLimitKey } from "../lib/security/rateLimitCore.ts";

test("client ip takes the first forwarded address and falls back to unknown", () => {
  assert.equal(clientIp(new Request("https://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } })), "1.2.3.4");
  assert.equal(clientIp(new Request("https://x", { headers: { "x-real-ip": "5.6.7.8" } })), "5.6.7.8");
  assert.equal(clientIp(new Request("https://x")), "unknown");
});

test("keys are scoped, lower-cased and bounded", () => {
  assert.equal(rateLimitKey("chat", "1.2.3.4"), "chat:1.2.3.4");
  assert.equal(rateLimitKey("signup", "Someone@Example.COM"), "signup:someone@example.com");
  assert.equal(rateLimitKey("x", "a".repeat(500)).length, 2 + 200);
  assert.match(dayKey(new Date("2026-11-03T23:59:59Z")), /^2026-11-03$/);
});

test("allowRequest passes the rule to the store and fails open on errors", async () => {
  const calls: Array<[string, number, number]> = [];
  const allowed = await allowRequest("chat", "ip", { limit: 3, windowSeconds: 60 }, {
    hit: async (key, limit, windowSeconds) => { calls.push([key, limit, windowSeconds]); return false; },
  });
  assert.equal(allowed, false);
  assert.deepEqual(calls, [["chat:ip", 3, 60]]);

  const failedOpen = await allowRequest("chat", "ip", { limit: 3, windowSeconds: 60 }, {
    hit: async () => { throw new Error("db down"); },
  });
  assert.equal(failedOpen, true);
});
