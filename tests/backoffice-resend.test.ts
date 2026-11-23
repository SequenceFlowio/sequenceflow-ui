import assert from "node:assert/strict";
import test from "node:test";

import { judgeUsage, parseResendUsage } from "../lib/backoffice/resendUsageCore.ts";

const body = (daily: { used: number; limit: number | null }, monthly: { used: number; limit: number }) => ({
  object: "usage",
  emails: {
    daily: { ...daily, sent: daily.used, received: 0, resets_at: "2026-11-24T10:00:00Z" },
    monthly: { ...monthly, sent: monthly.used - 10, received: 10, resets_at: "2026-12-01T00:00:00Z" },
  },
  domains: { used: 1, limit: 1 },
  rate_limit: { limit: 5, duration: "1000ms" },
});

test("het antwoord van Resend wordt gelezen", () => {
  const usage = parseResendUsage(body({ used: 12, limit: 100 }, { used: 400, limit: 3000 }));
  assert.ok(usage);
  assert.equal(usage.daily.limit, 100);
  assert.equal(usage.monthly.received, 10);
  assert.equal(usage.daily.resetsAt, "2026-11-24T10:00:00Z");
  assert.deepEqual(usage.rateLimit, { limit: 5, duration: "1000ms" });
  assert.equal(parseResendUsage({ message: "forbidden" }), null);
});

test("advies: ruim binnen, in de gaten houden, upgraden, limiet bereikt", () => {
  const day = new Date("2026-11-15T12:00:00Z");
  const verdict = (daily: { used: number; limit: number | null }, monthly: { used: number; limit: number }) => judgeUsage(parseResendUsage(body(daily, monthly))!, day);
  assert.equal(verdict({ used: 10, limit: 100 }, { used: 500, limit: 3000 }).level, "ok");
  // halverwege de maand op 45%: verwacht 90% aan het eind
  assert.equal(verdict({ used: 10, limit: 100 }, { used: 1350, limit: 3000 }).level, "watch");
  // tempo gaat over de limiet heen
  const fast = verdict({ used: 10, limit: null }, { used: 1700, limit: 3000 });
  assert.equal(fast.level, "upgrade");
  assert.equal(fast.projectedMonth, 3400);
  assert.equal(verdict({ used: 85, limit: 100 }, { used: 500, limit: 3000 }).level, "upgrade");
  assert.equal(verdict({ used: 100, limit: 100 }, { used: 500, limit: 3000 }).level, "blocked");
  assert.equal(verdict({ used: 10, limit: null }, { used: 3000, limit: 3000 }).level, "blocked");
});

test("aan het begin van de maand wordt het tempo nog niet doorgetrokken", () => {
  const verdict = judgeUsage(parseResendUsage(body({ used: 50, limit: null }, { used: 300, limit: 3000 }))!, new Date("2026-11-02T09:00:00Z"));
  assert.equal(verdict.projectedMonth, 300);
  assert.equal(verdict.level, "ok");
});
