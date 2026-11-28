import assert from "node:assert/strict";
import test from "node:test";

import { buildDashboard, realSignupEvents, sourceOf, type RawData, type RawMarketingEvent } from "../lib/backoffice/metrics.ts";
import { classifyClient, isAutomatedClient } from "../lib/marketing/attributionCore.ts";

const NOW = "2026-11-28T09:00:00.000Z";

test("soort bezoeker uit de user-agent", () => {
  assert.equal(classifyClient(null), "bot");
  assert.equal(classifyClient("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), "bot");
  assert.equal(classifyClient("facebookexternalhit/1.1"), "bot");
  assert.equal(classifyClient("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36"), "headless");
  assert.equal(classifyClient("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0"), "instagram");
  assert.equal(classifyClient("Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]"), "facebook");
  assert.equal(classifyClient("Mozilla/5.0 (Linux; Android 13) musical_ly_2023 BytedanceWebview/d8a21c6"), "tiktok");
  assert.equal(classifyClient("Mozilla/5.0 (iPhone) Mobile/15E148 LinkedInApp/9.29"), "linkedin");
  assert.equal(classifyClient("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"), "browser");
  assert.ok(isAutomatedClient("bot") && isAutomatedClient("headless") && !isAutomatedClient("instagram"));
});

test("in-app browser zonder referrer telt niet meer als direct", () => {
  const base = { utmSource: null, gclid: null, fbclid: null, referrer: null };
  assert.equal(sourceOf({ ...base, client: "instagram" }), "meta (organisch)");
  assert.equal(sourceOf({ ...base, client: "tiktok" }), "tiktok");
  assert.equal(sourceOf({ ...base, client: "browser" }), "direct");
  assert.equal(sourceOf({ ...base, referrer: "https://www.tiktok.com/" }), "tiktok");
  // utm gaat altijd voor
  assert.equal(sourceOf({ ...base, utmSource: "LinkedIn", client: "instagram" }), "linkedin");
});

const event = (over: Partial<RawMarketingEvent>): RawMarketingEvent => ({
  event: "landing_view", sessionId: "s", tenantId: null, path: "/nl", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null,
  gclid: null, fbclid: null, label: null, createdAt: NOW, client: "browser", ...over,
});

function raw(): RawData {
  return {
    now: NOW,
    tenants: [
      // oud account dat steeds opnieuw inlogt
      { id: "oud", name: "Oud", plan: "pro", created_at: "2026-03-05T10:00:00Z", trial_ends_at: null, stripe_customer_id: null, stripe_subscription_id: "sub_1", referred_by_tenant_id: null, affiliate_id: null, referral_code: null },
      // nieuwe aanmelding via Meta, koppelt en verstuurt
      { id: "nieuw", name: "Nieuw", plan: "trial", created_at: "2026-11-24T10:00:00Z", trial_ends_at: "2026-12-08T10:00:00Z", stripe_customer_id: null, stripe_subscription_id: null, referred_by_tenant_id: null, affiliate_id: null, referral_code: null },
      // aanmelding zonder koppeling
      { id: "stil", name: "Stil", plan: "trial", created_at: "2026-11-25T10:00:00Z", trial_ends_at: "2026-12-09T10:00:00Z", stripe_customer_id: null, stripe_subscription_id: null, referred_by_tenant_id: null, affiliate_id: null, referral_code: null },
      // teamaccount
      { id: "team", name: "Team", plan: "trial", created_at: "2026-11-26T10:00:00Z", trial_ends_at: "2026-12-10T10:00:00Z", stripe_customer_id: null, stripe_subscription_id: null, referred_by_tenant_id: null, affiliate_id: null, referral_code: null },
    ],
    owners: {}, subscriptions: [], invoices: [], refunds: [], affiliates: [], rewards: [], shopify: [],
    events: [
      event({ sessionId: "a", fbclid: "x", createdAt: "2026-11-24T09:00:00Z" }),
      event({ sessionId: "a", event: "signup_completed", tenantId: "nieuw", path: "/auth/callback", fbclid: "x", createdAt: "2026-11-24T10:01:00Z" }),
      event({ sessionId: "b", createdAt: "2026-11-25T09:00:00Z" }),
      event({ sessionId: "c", client: "instagram", createdAt: "2026-11-26T09:00:00Z" }),
      // herhaalde logins van het oude account: geen aanmeldingen
      event({ sessionId: "d", event: "signup_completed", tenantId: "oud", path: "/auth/callback", createdAt: "2026-11-23T10:00:00Z" }),
      event({ sessionId: "e", event: "signup_completed", tenantId: "nieuw", path: "/auth/callback", createdAt: "2026-11-27T10:00:00Z" }),
    ],
    connected: ["nieuw"], drafts30: {},
    milestones: {
      nieuw: { connectedAt: "2026-11-24T11:00:00Z", firstDraftAt: "2026-11-24T12:00:00Z", firstSentAt: "2026-11-25T08:00:00Z" },
      stil: { connectedAt: null, firstDraftAt: null, firstSentAt: null },
    },
    internalTenants: ["team"],
    planPriceCents: { pro: 14900 }, affiliateMinPayoutCents: 1, stripeAvailable: false, notes: [],
  };
}

test("alleen de eerste aanmelding per werkruimte, vlak na het aanmaken", () => {
  const signups = realSignupEvents(raw()).events.filter((e) => e.event === "signup_completed");
  assert.deepEqual(signups.map((e) => `${e.tenantId}:${e.sessionId}`), ["nieuw:a"]);
});

test("funnel per week en per bron", () => {
  const { funnel, marketing } = buildDashboard(raw());
  assert.equal(marketing.signups, 1);
  const week = funnel.weeks.at(-1)!;
  assert.equal(week.key, "2026-11-23");
  assert.deepEqual({ ...week, key: undefined }, { key: undefined, visits: 3, signups: 2, mailbox: 1, draft: 1, sent: 1, paid: 0 });
  // het oude account (maart) valt buiten de 8 weken; het teamaccount telt niet
  assert.equal(funnel.totals.signups, 2);
  const meta = funnel.sources.find((row) => row.key === "meta ads")!;
  assert.equal(meta.visits, 1);
  assert.equal(meta.sent, 1);
  assert.equal(funnel.sources.find((row) => row.key === "meta (organisch)")?.visits, 1);
  assert.equal(funnel.sources.find((row) => row.key === "onbekend")?.signups, 1);
});

test("knelpunt pas bij genoeg aantallen", () => {
  assert.equal(buildDashboard(raw()).funnel.bottleneck, null);
  const many = raw();
  for (let i = 0; i < 200; i++) many.events.push(event({ sessionId: `v${i}`, createdAt: "2026-11-27T09:00:00Z" }));
  const bottleneck = buildDashboard(many).funnel.bottleneck;
  assert.equal(bottleneck?.key, "signups");
});
