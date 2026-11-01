import assert from "node:assert/strict";
import test from "node:test";

import { REFERRAL, affiliateRate, commissionCents, estimatedMonthlyCommission, newReferralCode, referralCreditCents, usernameProblem } from "../lib/referrals/program.ts";

test("affiliate earns 5% on customers 1-5 and 10% from customer 6", () => {
  assert.equal(affiliateRate(1), 0.05);
  assert.equal(affiliateRate(5), 0.05);
  assert.equal(affiliateRate(6), 0.1);
  assert.equal(affiliateRate(40), 0.1);
});

test("commission is rounded to whole cents", () => {
  assert.equal(commissionCents(22_900, 0.05), 1_145);
  assert.equal(commissionCents(7_900, 0.1), 790);
});

test("estimated monthly commission applies the tier per customer", () => {
  // 5 x Growth at 5% + 1 x Growth at 10%
  assert.equal(estimatedMonthlyCommission(Array(6).fill(22_900)), 5 * 1_145 + 2_290);
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
