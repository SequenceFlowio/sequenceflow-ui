import assert from "node:assert/strict";
import test from "node:test";

import { AUTO_SEND_PLANS, PLAN_LIMITS } from "../lib/billingPlans.ts";

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
