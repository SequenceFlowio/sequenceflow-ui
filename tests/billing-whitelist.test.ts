import assert from "node:assert/strict";
import test from "node:test";

import { bestWhitelistedPlan, isTeamWhitelistedEmail, whitelistedPlan } from "../lib/billingWhitelist.ts";

test("whitelisted accounts get their own plan, case-insensitively", () => {
  assert.equal(whitelistedPlan("sequenceflownl@gmail.com"), "agency");
  assert.equal(whitelistedPlan(" Deadtheon@Gmail.com "), "agency");
  assert.equal(whitelistedPlan("someone@example.com"), null);
  assert.equal(whitelistedPlan(null), null);
});

test("only our own team may open the app without a workspace, not every Scale account", () => {
  assert.ok(isTeamWhitelistedEmail("sequenceflownl@gmail.com"));
  assert.ok(!isTeamWhitelistedEmail("deadtheon@gmail.com"));
});

test("a workspace gets the best plan among its members", () => {
  assert.equal(bestWhitelistedPlan(["deadtheon@gmail.com", "sequenceflownl@gmail.com"]), "agency");
  assert.equal(bestWhitelistedPlan([undefined, "deadtheon@gmail.com"]), "agency");
  assert.equal(bestWhitelistedPlan(["a@b.nl", null]), null);
});
