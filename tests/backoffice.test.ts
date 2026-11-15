import assert from "node:assert/strict";
import test from "node:test";

import { cleanCode, evaluateAdminClaims, MFA_MAX_AGE_SECONDS } from "../lib/backoffice/authCore.ts";
import { buildDashboard, sourceOf, weekStart, type RawData } from "../lib/backoffice/metrics.ts";

const NOW = "2026-11-15T09:00:00.000Z";
const nowSeconds = Math.floor(Date.parse(NOW) / 1000);
const ADMINS = "ezra@example.com, Team@Example.com";

test("alleen een beheerder met een verse authenticator-bevestiging komt binnen", () => {
  const amr = [{ method: "otp", timestamp: nowSeconds - 60 }, { method: "totp", timestamp: nowSeconds - 30 }];
  assert.equal(evaluateAdminClaims(null, ADMINS, nowSeconds).state, "signed_out");
  assert.equal(evaluateAdminClaims({ email: "klant@example.com", aal: "aal2", amr }, ADMINS, nowSeconds).state, "not_admin");
  assert.equal(evaluateAdminClaims({ email: "ezra@example.com", aal: "aal1", amr: [amr[0]] }, ADMINS, nowSeconds).state, "needs_mfa");
  assert.equal(evaluateAdminClaims({ email: "TEAM@example.com", aal: "aal2", amr }, ADMINS, nowSeconds).state, "ok");
  // aal2 zonder authenticator in het token telt niet
  assert.equal(evaluateAdminClaims({ email: "ezra@example.com", aal: "aal2", amr: [amr[0]] }, ADMINS, nowSeconds).state, "needs_mfa");
  // te lang geleden bevestigd
  const old = [{ method: "totp", timestamp: nowSeconds - MFA_MAX_AGE_SECONDS - 1 }];
  assert.equal(evaluateAdminClaims({ email: "ezra@example.com", aal: "aal2", amr: old }, ADMINS, nowSeconds).state, "needs_mfa");
  // lege lijst = niemand
  assert.equal(evaluateAdminClaims({ email: "ezra@example.com", aal: "aal2", amr }, "", nowSeconds).state, "not_admin");
});

test("codes: alleen cijfers", () => {
  assert.equal(cleanCode(" 123 456 "), "123456");
  assert.equal(cleanCode(123456), "");
});

test("herkomst van een bezoek", () => {
  const base = { utmSource: null, gclid: null, fbclid: null, referrer: null };
  assert.equal(sourceOf({ ...base, utmSource: "Meta" }), "meta");
  assert.equal(sourceOf({ ...base, gclid: "x" }), "google ads");
  assert.equal(sourceOf({ ...base, fbclid: "x" }), "meta ads");
  assert.equal(sourceOf({ ...base, referrer: "https://www.google.nl/search" }), "google (organisch)");
  assert.equal(sourceOf({ ...base, referrer: "https://www.sequenceflow.io/pricing" }), "direct");
  assert.equal(sourceOf({ ...base, referrer: "https://tweakers.net/x" }), "tweakers.net");
  assert.equal(sourceOf(base), "direct");
});

test("week begint op maandag", () => {
  assert.equal(weekStart("2026-11-15T09:00:00Z"), "2026-11-09");
  assert.equal(weekStart("2026-11-09T00:00:00Z"), "2026-11-09");
});

function raw(): RawData {
  const days = (count: number) => new Date(Date.parse(NOW) - count * 86_400_000).toISOString();
  const tenant = (id: string, plan: string, ageDays: number, extra: Partial<RawData["tenants"][number]> = {}) => ({
    id, name: id, plan, created_at: days(ageDays), trial_ends_at: days(ageDays - 14), stripe_customer_id: null, stripe_subscription_id: null,
    referred_by_tenant_id: null, affiliate_id: null, referral_code: null, ...extra,
  });
  const event = (name: string, sessionId: string, extra: Partial<RawData["events"][number]> = {}) => ({
    event: name, sessionId, tenantId: null, path: "/support-one", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, gclid: null, fbclid: null, label: null, createdAt: days(5), ...extra,
  });
  return {
    now: NOW,
    tenants: [
      tenant("betaler", "pro", 60, { stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", affiliate_id: "aff_1" }),
      tenant("opzegger", "expired", 90, { stripe_customer_id: "cus_2" }),
      tenant("proef", "trial", 3),
      tenant("verlopen", "expired", 40),
      tenant("intern", "agency", 200),
      tenant("shopify", "starter", 30),
    ],
    owners: { betaler: { email: "a@b.nl", lastSignInAt: null } },
    subscriptions: [
      { id: "sub_1", customerId: "cus_1", status: "active", startedAt: days(50), canceledAt: null, cancelAt: null, monthlyCents: 14700, reason: null },
      { id: "sub_2", customerId: "cus_2", status: "canceled", startedAt: days(80), canceledAt: days(10), cancelAt: null, monthlyCents: 4700, reason: "te duur" },
    ],
    invoices: [
      { id: "in_1", customerId: "cus_1", status: "paid", netCents: 14700, createdAt: days(50), paidAt: days(50), reason: "subscription_create", attempts: 1 },
      { id: "in_2", customerId: "cus_1", status: "paid", netCents: 15000, createdAt: days(2), paidAt: days(2), reason: "subscription_cycle", attempts: 1 },
      { id: "in_3", customerId: "cus_2", status: "paid", netCents: 4700, createdAt: days(80), paidAt: days(80), reason: "subscription_create", attempts: 1 },
    ],
    refunds: [],
    events: [
      event("landing_view", "s1", { utmSource: "meta", utmCampaign: "q4" }),
      event("cta_click", "s1", { label: "Start" }),
      event("signup_completed", "s1", { tenantId: "proef", utmSource: "meta", utmCampaign: "q4", createdAt: days(3) }),
      event("landing_view", "s2"),
      event("landing_view", "klik-1", { path: "/r/lisa" }),
      event("landing_view", "klik-2", { path: "/r/lisa" }),
    ],
    affiliates: [{ id: "aff_1", username: "lisa", name: "Lisa", email: "l@x.nl", channel: null, status: "active", isBusiness: false, createdAt: days(100) }],
    rewards: [
      { id: "r1", kind: "affiliate_commission", affiliateId: "aff_1", referrerTenantId: null, referredTenantId: "betaler", amountCents: 735, baseCents: 14700, rate: 0.05, status: "available", invoicePaidAt: days(50), availableAt: days(1) },
      { id: "r2", kind: "affiliate_commission", affiliateId: "aff_1", referrerTenantId: null, referredTenantId: "betaler", amountCents: 750, baseCents: 15000, rate: 0.05, status: "pending", invoicePaidAt: days(2), availableAt: days(-58) },
    ],
    shopify: [{ tenantId: "shopify", shop: "x.myshopify.com", status: "active", installedAt: days(30), uninstalledAt: null }],
    connected: ["betaler"], drafts30: { betaler: 12 },
    planPriceCents: { starter: 4700, pro: 14700, agency: 29700 }, affiliateMinPayoutCents: 500, stripeAvailable: true, notes: [],
  };
}

test("status, omzet en omzetting per werkruimte", () => {
  const dashboard = buildDashboard(raw());
  const by = Object.fromEntries(dashboard.customers.map((customer) => [customer.id, customer]));
  assert.equal(by.betaler.status, "paying");
  assert.equal(by.betaler.channel, "stripe");
  assert.equal(by.betaler.daysToPay, 10);
  assert.equal(by.betaler.source, "Affiliate: lisa");
  assert.equal(by.opzegger.status, "canceled");
  assert.equal(by.opzegger.cancelReason, "te duur");
  assert.equal(by.proef.status, "trial");
  assert.equal(by.proef.source, "meta · q4");
  assert.equal(by.verlopen.status, "trial_expired");
  // betaald pakket zonder Stripe of Shopify = intern, telt niet als omzet
  assert.equal(by.intern.status, "free");
  assert.equal(by.intern.mrrCents, 0);
  // Shopify rekent zelf af: geschat op de pakketprijs
  assert.equal(by.shopify.status, "paying");
  assert.equal(by.shopify.mrrEstimated, true);

  const o = dashboard.overview;
  assert.equal(o.mrrCents, 14700 + 4700);
  assert.equal(o.paying, 2);
  assert.equal(o.trials, 1);
  assert.equal(o.canceled30, 1);
  assert.equal(o.revenueThisMonthCents, 15000);
  // afgelopen proeven: betaler, opzegger, verlopen, shopify (intern telt niet mee); drie daarvan gingen betalen
  assert.equal(o.conversionBase, 4);
  assert.equal(o.conversionPct, 75);
  assert.equal(by.shopify.daysToPay, 14);
});

test("bezoek, kliks op partnerlinks en commissie", () => {
  const dashboard = buildDashboard(raw());
  const m = dashboard.marketing;
  // kliks op /r/ tellen niet als bezoek
  assert.equal(m.sessions, 2);
  assert.equal(m.ctaSessions, 1);
  assert.equal(m.signups, 1);
  assert.deepEqual(m.bySource.map((row) => [row.key, row.sessions, row.signups]), [["meta", 1, 1], ["direct", 1, 0]]);

  const r = dashboard.referrals;
  assert.equal(r.clicksTotal, 2);
  assert.equal(r.affiliates[0].clicks, 2);
  assert.equal(r.affiliates[0].paying, 1);
  assert.equal(r.affiliates[0].availableCents, 735);
  assert.equal(r.affiliates[0].pendingCents, 750);
  assert.equal(r.payoutsDue.length, 1);
  assert.equal(r.viaAffiliate, 1);
});

import { formatIban, isValidIban, normalizeIban, payoutAmounts, payoutInvoiceNumber } from "../lib/referrals/payoutCore.ts";

test("IBAN: vorm en controlegetal", () => {
  assert.equal(normalizeIban("nl91 abna 0417 1643 00"), "NL91ABNA0417164300");
  assert.equal(isValidIban("NL91 ABNA 0417 1643 00"), true);
  assert.equal(isValidIban("DE89 3704 0044 0532 0130 00"), true);
  assert.equal(isValidIban("BE68 5390 0754 7034"), true);
  // één cijfer anders: controlegetal klopt niet meer
  assert.equal(isValidIban("NL91 ABNA 0417 1643 01"), false);
  assert.equal(isValidIban("geen iban"), false);
  assert.equal(isValidIban(""), false);
  assert.equal(formatIban("nl91abna0417164300"), "NL91 ABNA 0417 1643 00");
});

test("uitbetaling: btw alleen voor ondernemers met een btw-nummer", () => {
  assert.deepEqual(payoutAmounts(10_000, { isBusiness: true, vatNumber: "NL123456789B01" }), { amountCents: 10_000, vatCents: 2_100, totalCents: 12_100 });
  assert.deepEqual(payoutAmounts(10_000, { isBusiness: true, vatNumber: " " }), { amountCents: 10_000, vatCents: 0, totalCents: 10_000 });
  assert.deepEqual(payoutAmounts(10_000, { isBusiness: false, vatNumber: "NL123456789B01" }), { amountCents: 10_000, vatCents: 0, totalCents: 10_000 });
  assert.equal(payoutInvoiceNumber(7, "2026-11-15T10:00:00Z"), "SB-2026-0007");
});
