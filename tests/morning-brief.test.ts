import assert from "node:assert/strict";
import test from "node:test";

import { adProposals, buildMorningBrief, buyerSignals, type BriefAds, type BriefInput } from "../lib/marketing/morningBriefCore.ts";

const ads = (campaigns: BriefAds["campaigns"]): BriefAds => ({ linked: true, error: null, totals: { spendCents: 10000, impressions: 10000, clicks: 100, ctrPct: 1, cpcCents: 100 }, campaigns });

test("advertentievoorstellen volgen vaste regels", () => {
  const out = adProposals(ads([
    { name: "Pijn", spendCents: 4500, clicks: 60, impressions: 5000, signups: 0 },
    { name: "Hook zwak", spendCents: 1500, clicks: 10, impressions: 3000, signups: 1 },
    { name: "Duur", spendCents: 4000, clicks: 20, impressions: 1500, signups: 1 },
    { name: "Winnaar", spendCents: 6000, clicks: 90, impressions: 6000, signups: 3 },
    { name: "Rustig", spendCents: 500, clicks: 8, impressions: 600, signups: 0 },
  ]));
  assert.deepEqual(out.map((p) => `${p.campaign}: ${p.change}`), [
    "Pijn: Pauzeren of de landingspagina wisselen",
    "Hook zwak: Nieuwe hook of creative testen",
    "Duur: Doelgroep verbreden of bod verlagen",
    "Winnaar: Budget 20% omhoog",
  ]);
  assert.deepEqual(adProposals({ linked: false, error: null, totals: null, campaigns: [] }), []);
});

test("kopersignalen wegen zwaarder dan likes", () => {
  const base = { platform: "instagram" as const, title: "x", publishedAt: "2026-11-27T10:00:00Z", reach: 5000, likes: 200, comments: 0, saves: 0, shares: 0, follows: 0, profileVisits: 0 };
  assert.equal(buyerSignals(base), 0);
  assert.ok(buyerSignals({ ...base, likes: 5, comments: 4, follows: 2 }) > buyerSignals(base));
});

const input = (over: Partial<BriefInput> = {}): BriefInput => ({
  now: "2026-11-30T06:30:00Z",
  thisWeek: { visits: 40, signups: 2, mailbox: 1, draft: 1, sent: 0, paid: 0 },
  lastWeek: { visits: 30, signups: 1, mailbox: 0, draft: 0, sent: 0, paid: 0 },
  bottleneck: null,
  yesterday: { visits: 12, signups: 1, bySource: [{ source: "instagram", visits: 5, signups: 1 }] },
  ads: { linked: false, error: null, totals: null, campaigns: [] },
  posts: [
    { platform: "instagram", title: "Waar blijft mijn pakket", publishedAt: "2026-11-29T09:00:00Z", reach: 800, likes: 20, comments: 6, saves: 3, shares: 1, follows: 2, profileVisits: 9 },
    { platform: "tiktok", title: "Waar blijft mijn pakket", publishedAt: "2026-11-29T09:00:00Z", reach: null, likes: 0, comments: 0, saves: 0, shares: 0, follows: 0, profileVisits: 0, status: "published" },
  ],
  socialVisits: { instagram: 9, tiktok: 2, signups: 1 },
  leadsDue: [{ name: "Voorbeeldwinkel", action: "Opvolgen (linkedin)", when: "30 nov" }],
  followupsReady: [{ name: "Testshop", step: 2, subject: "Lukt het koppelen van je mailbox?" }],
  newLeads: 5,
  backofficeUrl: "https://www.sequenceflow.io/backoffice?tab=opvolging",
  ...over,
});

test("brief: eerst wat er vandaag moet, dan funnel, ads en social", () => {
  const brief = buildMorningBrief(input());
  const headings = brief.blocks.filter((b) => b.type === "heading").map((b) => (b as { text: string }).text);
  assert.deepEqual(headings, ["Vandaag doen", "Funnel deze week", "Meta-advertenties (7 dagen)", "Instagram en TikTok"]);
  assert.match(brief.subject, /^Ochtendbrief maandag 30 november: 2 acties vandaag/);
  const text = JSON.stringify(brief.blocks);
  assert.match(text, /Mail dag 2: Testshop/);
  assert.match(text, /Opvolgen \(linkedin\): Voorbeeldwinkel/);
  assert.match(text, /\+10 t\.o\.v\. vorige week/);
  assert.match(text, /Niet gekoppeld: zet META_ADS_ACCESS_TOKEN/);
  assert.match(text, /Meeste kopersignalen/);
});

test("brief zonder acties en met gekoppelde ads toont voorstellen als voorstel", () => {
  const brief = buildMorningBrief(input({ leadsDue: [], followupsReady: [], ads: ads([{ name: "Pijn", spendCents: 4500, clicks: 60, impressions: 5000, signups: 0 }]) }));
  const text = JSON.stringify(brief.blocks);
  assert.match(text, /5 nieuwe leads klaar om te beoordelen/);
  assert.match(text, /ik voer niets uit zonder jouw akkoord/);
  assert.equal(brief.proposals.length, 1);
});
