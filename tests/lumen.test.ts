import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildLumenSuggestions, citedLumenSourceIds, parseLumenMessages } from "../lib/lumen/chat.ts";
import type { LumenSnapshot } from "../lib/lumen/types.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const snapshot: Omit<LumenSnapshot, "suggestions"> = {
  generatedAt: "2026-07-30T12:00:00.000Z",
  periodDays: 30,
  support: {
    conversations: 12,
    sent: 8,
    review: 3,
    escalated: 1,
    spam: 0,
    autoSent: 4,
    averageConfidence: 0.82,
    confidenceSampleSize: 10,
    topIntents: [{ intent: "shipping", count: 5 }],
  },
  painPoints: {
    intro: "Levering vraagt aandacht.",
    ticketCount: 12,
    items: [{
      category: "Pakket vertraagd",
      count: 5,
      percentage: 42,
      description: "Klanten missen voortgang.",
      recommendedAction: "Communiceer proactief.",
    }],
  },
  commerce: {
    connected: true,
    connectionStatus: "active",
    orders: 10,
    openOrders: 2,
    products: 3,
    lowStock: 1,
    activeReturns: 1,
    shipmentsWithoutTransportEvent: 0,
    coverage: null,
    summary: null,
    signals: [{
      id: "stock:1",
      severity: "attention",
      title: "Weinig voorraad",
      finding: "Voorraad is laag.",
      recommendedAction: "Vul aan.",
      sample: 5,
    }],
    topProducts: [],
  },
  knowledge: { ready: 2, processing: 0, attention: 0, categories: [{ category: "general", count: 2 }] },
  agentProfile: { active: true, approvedFacts: 4, proposedFacts: 1, approvedByKind: [{ kind: "fact", count: 4 }] },
  sources: [
    { id: "support-30d", label: "Klantcontact", detail: "12 gesprekken", status: "ready" },
    { id: "commerce-30d", label: "Commerce", detail: "10 orders", status: "ready" },
  ],
};

test("Lumen accepts only bounded user and assistant history ending in a user question", () => {
  assert.deepEqual(parseLumenMessages([
    { role: "assistant", content: "Waarmee kan ik helpen?" },
    { role: "user", content: "  Welke problemen zie je?  " },
  ]), [
    { role: "assistant", content: "Waarmee kan ik helpen?" },
    { role: "user", content: "Welke problemen zie je?" },
  ]);
  assert.throws(() => parseLumenMessages([{ role: "assistant", content: "Geen vraag" }]));
  assert.throws(() => parseLumenMessages([{ role: "user", content: "x".repeat(4_001) }]));
});

test("Lumen suggestions use available pain-point and commerce evidence", () => {
  const suggestions = buildLumenSuggestions(snapshot, "nl");
  assert.equal(suggestions[0], "Hoe kan ik voor minder klantvragen zorgen?");
  assert.ok(suggestions.some((item) => item.includes("pakket vertraagd")));
  assert.ok(suggestions.some((item) => item.includes("commerce-signaal")));
});

test("Lumen citations only expose source ids supplied by the server", () => {
  assert.deepEqual(
    citedLumenSourceIds(
      "Er zijn 12 gesprekken [support-30d]. Niet gebruiken [unknown]. Nogmaals [support-30d].",
      snapshot.sources,
    ),
    ["support-30d"],
  );
});

test("Lumen API is tenant-bound, aggregate-first, read-only, and streamed", () => {
  const route = source("app/api/lumen/chat/route.ts");
  const context = source("lib/lumen/context.ts");
  const page = source("app/(app)/lumen/LumenClient.tsx");
  const proxy = source("proxy.ts");

  assert.match(route, /getTenantId\(req\)/);
  assert.match(route, /loadLumenSnapshot\(context\.tenantId/);
  assert.match(route, /retrieveKnowledgeMatches\(context\.tenantId/);
  assert.match(route, /gpt-5\.4-mini-2026-03-17/);
  assert.match(route, /reasoning_effort: "low"/);
  assert.match(route, /stream: true/);
  assert.match(route, /application\/x-ndjson/);
  assert.match(route, /Lumen is read-only/);
  assert.match(route, /eq\("operation", "lumen_chat"\)/);
  assert.doesNotMatch(context, /support_messages|body_original|customer_email|customer_name/);
  assert.doesNotMatch(route, /\.(?:insert|update|delete|upsert)\(/);
  assert.match(page, /Hoe kan ik voor minder klantvragen zorgen/);
  assert.match(page, /citedLumenSourceIds/);
  assert.match(page, /abortRef\.current\?\.abort/);
  assert.match(proxy, /"\/lumen"/);
});

test("Agent DNA deep distillation uses the pinned GPT-5.4 mini model", () => {
  const distill = source("lib/mining/distillProfile.ts");
  assert.match(distill, /AGENT_DNA_DISTILL_MODEL/);
  assert.match(distill, /gpt-5\.4-mini-2026-03-17/);
  assert.match(distill, /reasoning_effort: "medium"/);
  assert.doesNotMatch(distill, /temperature:/);
});

test("Lumen is a primary navigation destination and privacy text explains its boundary", () => {
  const sidebar = source("components/Sidebar.tsx");
  const privacy = source("app/privacy/page.tsx");
  assert.match(sidebar, /key: "lumen"[\s\S]+href: "\/lumen"/);
  assert.match(sidebar, /BrainCircuit/);
  assert.match(privacy, /Lumen receives aggregate support/);
  assert.match(privacy, /cannot change orders, returns, shipments, stock, email, or configuration/);
});
