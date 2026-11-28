import assert from "node:assert/strict";
import test from "node:test";

import { dueFollowups, followupContent, leadKeyForEmail, type TrialState } from "../lib/sales/trialCore.ts";

const links = { upgradeUrl: "https://app.example/upgrade", demoUrl: null, knowledgeUrl: "https://app.example/knowledge" };
const state = (over: Partial<TrialState> = {}): TrialState => ({
  tenantId: "t", createdAt: "2026-11-20T10:00:00Z", plan: "trial", trialEndsAt: "2026-12-04T10:00:00Z",
  connectedAt: null, firstDraftAt: null, firstSentAt: null, paying: false, internal: false, ...over,
});

test("dag 2 kiest de tekst op basis van hoe ver iemand is", () => {
  assert.equal(followupContent(2, state(), links).variant, "geen-mailbox");
  assert.equal(followupContent(2, state({ connectedAt: "x" }), links).variant, "geen-concept");
  assert.equal(followupContent(2, state({ connectedAt: "x", firstDraftAt: "y" }), links).variant, "eerste-concepten");
  assert.equal(followupContent(7, state({ firstSentAt: "z" }), links).variant, "verstuurt-al");
  assert.match(followupContent(12, state(), links).body, /€49/);
});

test("zonder demo-link vraagt de mail om te antwoorden, met link staat die erin", () => {
  assert.match(followupContent(2, state(), links).body, /Antwoord op deze mail/);
  assert.match(followupContent(2, state(), { ...links, demoUrl: "https://cal.example/navaron" }).body, /cal\.example\/navaron/);
});

test("op dag 2 staat precies één concept klaar", () => {
  const result = dueFollowups(state(), [], "2026-11-22T11:00:00Z", links);
  assert.deepEqual(result.create.map((d) => d.step), [2]);
  assert.deepEqual(result.skip, []);
  // al aangemaakt: niets nieuws
  assert.deepEqual(dueFollowups(state(), [2], "2026-11-23T11:00:00Z", links).create, []);
  // vóór dag 2: niets
  assert.deepEqual(dueFollowups(state(), [], "2026-11-21T11:00:00Z", links).create, []);
});

test("achterstand: alleen de laatste stap, eerdere overslaan", () => {
  const result = dueFollowups(state(), [], "2026-11-27T12:00:00Z", links);
  assert.deepEqual(result.create.map((d) => d.step), [7]);
  assert.deepEqual(result.skip, [2]);
});

test("te laat, betalend, intern of verlopen: geen concept", () => {
  assert.deepEqual(dueFollowups(state(), [], "2026-12-03T12:00:00Z", links).create.map((d) => d.step), [12]);
  assert.deepEqual(dueFollowups(state(), [], "2026-12-08T12:00:00Z", links).create, []); // dag 12 meer dan 4 dagen geleden
  assert.deepEqual(dueFollowups(state({ paying: true, plan: "starter" }), [], "2026-11-22T11:00:00Z", links).create, []);
  assert.deepEqual(dueFollowups(state({ internal: true }), [], "2026-11-22T11:00:00Z", links).create, []);
  const ended = dueFollowups(state({ trialEndsAt: "2026-12-01T10:00:00Z" }), [], "2026-12-02T12:00:00Z", links);
  assert.deepEqual(ended.create, []);
  assert.ok(ended.skip.includes(12));
});

test("lead-sleutel: bedrijfsdomein, of het adres bij gmail/hotmail", () => {
  assert.deepEqual(leadKeyForEmail("Jan@Voorbeeldwinkel.nl"), { domain: "voorbeeldwinkel.nl", business: true });
  assert.deepEqual(leadKeyForEmail("winkel@gmail.com"), { domain: "winkel@gmail.com", business: false });
  assert.equal(leadKeyForEmail("geen-adres"), null);
});
