import assert from "node:assert/strict";
import test from "node:test";

import { AUTO_SEND_PLANS, PLAN_LIMITS, usageHardLimit } from "../lib/billingPlans.ts";

test("published plans only promise the single inbox currently supported", () => {
  assert.equal(PLAN_LIMITS.starter.inboxes, 1);
  assert.equal(PLAN_LIMITS.pro.inboxes, 1);
  assert.equal(PLAN_LIMITS.agency.inboxes, 1);
});

test("team and document limits increase by plan", () => {
  assert.ok(PLAN_LIMITS.starter.members < PLAN_LIMITS.pro.members);
  assert.ok(PLAN_LIMITS.starter.docs < PLAN_LIMITS.pro.docs);
});

test("auto-send remains limited to paid automation plans", () => {
  assert.deepEqual(AUTO_SEND_PLANS, ["pro", "agency", "custom"]);
});

test("drafting stops at the plan limit plus 10% headroom", () => {
  assert.equal(usageHardLimit(100), 110);
  assert.equal(usageHardLimit(Infinity), Infinity);
});

test("plans grow with store volume", () => {
  assert.equal(PLAN_LIMITS.starter.aiAnswers, 150);
  assert.equal(PLAN_LIMITS.pro.aiAnswers, 500);
  assert.equal(PLAN_LIMITS.agency.aiAnswers, 1500);
});

test("usage period rolls forward monthly when no invoice moves it (partner plans)", async () => {
  const { currentUsagePeriodStart } = await import("../lib/billingPlans.ts");
  const now = new Date("2026-10-14T06:30:00Z");
  assert.equal(currentUsagePeriodStart("2026-03-01T00:00:00Z", now), "2026-10-01T00:00:00.000Z");
  assert.equal(currentUsagePeriodStart("2026-09-20T10:00:00Z", now), "2026-09-20T10:00:00.000Z");
  assert.equal(currentUsagePeriodStart("2026-08-20T10:00:00Z", now), "2026-09-20T10:00:00.000Z");
  assert.equal(currentUsagePeriodStart("2026-01-31T00:00:00Z", new Date("2026-03-01T12:00:00Z")), "2026-02-28T00:00:00.000Z");
  assert.equal(currentUsagePeriodStart("2026-10-10T00:00:00Z", now), "2026-10-10T00:00:00.000Z");
  assert.equal(currentUsagePeriodStart(null, now), "2026-10-01T00:00:00.000Z");
});
