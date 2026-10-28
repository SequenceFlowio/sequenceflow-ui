import assert from "node:assert/strict";
import test from "node:test";

import { bestWhitelistedPlan, isAgencyWhitelistedEmail, whitelistedPlan } from "../lib/billingWhitelist.ts";

test("whitelisted accounts get their own plan, case-insensitively", () => {
  assert.equal(whitelistedPlan("sequenceflownl@gmail.com"), "agency");
  assert.equal(whitelistedPlan(" Deadtheon@Gmail.com "), "pro");
  assert.equal(whitelistedPlan("someone@example.com"), null);
  assert.equal(whitelistedPlan(null), null);
});

test("only our own team counts as the agency whitelist", () => {
  assert.ok(isAgencyWhitelistedEmail("sequenceflownl@gmail.com"));
  assert.ok(!isAgencyWhitelistedEmail("deadtheon@gmail.com"));
});

test("a workspace gets the best plan among its members", () => {
  assert.equal(bestWhitelistedPlan(["deadtheon@gmail.com", "sequenceflownl@gmail.com"]), "agency");
  assert.equal(bestWhitelistedPlan([undefined, "deadtheon@gmail.com"]), "pro");
  assert.equal(bestWhitelistedPlan(["a@b.nl", null]), null);
});
