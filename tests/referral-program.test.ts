import assert from "node:assert/strict";
import test from "node:test";

import { REFERRAL, affiliateRate, commissionCents, estimatedMonthlyCommission, newReferralCode, referralCreditCents, usernameProblem } from "../lib/referrals/program.ts";

test("affiliate earns 10% on every customer", () => {
  assert.equal(affiliateRate(1), 0.1);
  assert.equal(affiliateRate(6), 0.1);
  assert.equal(affiliateRate(40), 0.1);
});

test("commission is rounded to whole cents", () => {
  assert.equal(commissionCents(22_900, 0.05), 1_145);
  assert.equal(commissionCents(7_900, 0.1), 790);
});

test("estimated monthly commission is 10% of what the customers pay", () => {
  assert.equal(estimatedMonthlyCommission(Array(6).fill(22_900)), 6 * 2_290);
});

test("referral credit scales with the plan of whoever gets it", () => {
  assert.equal(referralCreditCents(7_900, REFERRAL.referrerRate), 1_580);
  assert.equal(referralCreditCents(54_900, REFERRAL.referrerRate), 10_980);
  assert.equal(referralCreditCents(22_900, REFERRAL.newCustomerRate), 2_290);
  assert.equal(referralCreditCents(null, REFERRAL.referrerRate), 0);
});

test("usernames are validated and never look like a referral code", () => {
  assert.equal(usernameProblem("shopcoach"), null);
  assert.equal(usernameProblem("@ShopCoach"), null);
  assert.ok(usernameProblem("ab"));
  assert.ok(usernameProblem("shop coach"));
  assert.ok(usernameProblem("k-abc123"));
  assert.ok(usernameProblem("admin"));
  assert.match(newReferralCode(), /^k-[a-z2-9]{6}$/);
});

import { affiliateFunnel, canClaimCode, welcomeDiscountRate } from "../lib/referrals/program.ts";

test("klanten van affiliates en doorverwijzers krijgen 10% welkomstkorting", () => {
  assert.equal(welcomeDiscountRate({ affiliate_id: "a" }), 0.1);
  assert.equal(welcomeDiscountRate({ referred_by_tenant_id: "t" }), 0.1);
  assert.equal(welcomeDiscountRate({}), 0);
});

test("een code invullen kan alleen vóór de eerste betaling en één keer", () => {
  const fresh = { referred_by_tenant_id: null, affiliate_id: null, referral_credit_applied_at: null, stripe_subscription_id: null, plan: "trial" };
  assert.equal(canClaimCode(fresh), true);
  assert.equal(canClaimCode({ ...fresh, plan: "expired" }), true);
  assert.equal(canClaimCode({ ...fresh, affiliate_id: "a" }), false);
  assert.equal(canClaimCode({ ...fresh, stripe_subscription_id: "sub_1" }), false);
  assert.equal(canClaimCode({ ...fresh, plan: "pro" }), false);
  assert.equal(canClaimCode({ ...fresh, referral_credit_applied_at: "2026-11-01" }), false);
});

test("trechter van een affiliate: proef, betalend, afgehaakt, opgezegd", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  const funnel = affiliateFunnel([
    { id: "1", plan: "trial", trial_ends_at: "2026-11-20T00:00:00Z" },
    { id: "2", plan: "pro", trial_ends_at: null },
    { id: "3", plan: "expired", trial_ends_at: "2026-10-01T00:00:00Z" },
    { id: "4", plan: "expired", trial_ends_at: "2026-09-01T00:00:00Z" },
    { id: "5", plan: "trial", trial_ends_at: "2026-11-01T00:00:00Z" },
  ], new Set(["4"]), now);
  assert.deepEqual(funnel, { signups: 5, inTrial: 1, paying: 1, dropped: 2, canceled: 1, conversionPct: 50 });
});
