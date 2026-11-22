import assert from "node:assert/strict";
import test from "node:test";

import { acceptPromotion, applyApproval, ceilingFor, classifyApproval, INITIAL_STATE, ladderDecision, PROMOTION_STREAK, type TrustState } from "../lib/trust/ladderCore.ts";

test("ladder: plafonds per soort vraag", () => {
  assert.equal(ceilingFor("order_status"), 3);
  assert.equal(ceilingFor("return_request"), 2);
  for (const intent of ["complaint", "cancellation", "payment", "invoice", "fallback", "non_customer_supplier", null]) assert.equal(ceilingFor(intent), 1);
});

test("ladder: ongewijzigd, aangepast en gecorrigeerd", () => {
  assert.equal(classifyApproval("Je pakket is onderweg met PostNL.", "Je pakket is onderweg met PostNL."), "unchanged");
  assert.equal(classifyApproval("Je pakket is onderweg met PostNL.", "Hoi! Je pakket is al onderweg met PostNL, morgen in huis.", "tone"), "edited");
  assert.equal(classifyApproval("Retour kan binnen 14 dagen.", "Retour kan binnen 30 dagen, gratis.", "policy"), "corrected");
});

test("ladder: na 30 ongewijzigd op rij een voorstel, dan pas omhoog na ja", () => {
  let state: TrustState = INITIAL_STATE;
  let last = "";
  for (let i = 0; i < PROMOTION_STREAK; i += 1) ({ state, change: last } = applyApproval(state, "unchanged", "order_status"));
  assert.equal(last, "promotion_proposed");
  assert.deepEqual(state, { level: 1, streak: PROMOTION_STREAK, proposedLevel: 2 });
  state = acceptPromotion(state, "order_status");
  assert.deepEqual(state, { level: 2, streak: 0, proposedLevel: null });
});

test("ladder: nooit boven het plafond, en een klacht krijgt nooit een voorstel", () => {
  let state: TrustState = { level: 2, streak: 0, proposedLevel: null };
  for (let i = 0; i < PROMOTION_STREAK * 2; i += 1) state = applyApproval(state, "unchanged", "return_request").state;
  assert.equal(state.proposedLevel, null);
  let complaint: TrustState = INITIAL_STATE;
  for (let i = 0; i < PROMOTION_STREAK * 2; i += 1) complaint = applyApproval(complaint, "unchanged", "complaint").state;
  assert.equal(complaint.proposedLevel, null);
});

test("ladder: toon zet de reeks op nul, een correctie op feit of beleid zet terug naar trede 1", () => {
  const high: TrustState = { level: 3, streak: 12, proposedLevel: null };
  assert.deepEqual(applyApproval(high, "edited", "order_status").state, { level: 3, streak: 0, proposedLevel: null });
  assert.deepEqual(applyApproval(high, "corrected", "order_status"), { state: { level: 1, streak: 0, proposedLevel: null }, change: "demoted" });
});

test("ladder: wanneer zou hij zelf versturen", () => {
  const two: TrustState = { level: 2, streak: 3, proposedLevel: null };
  assert.equal(ladderDecision({ intent: "order_status", state: two, requiresHuman: false, factIssueCount: 0 }).wouldAutosend, true);
  assert.equal(ladderDecision({ intent: "order_status", state: two, requiresHuman: true, factIssueCount: 0 }).wouldAutosend, false);
  assert.equal(ladderDecision({ intent: "order_status", state: two, requiresHuman: false, factIssueCount: 1 }).wouldAutosend, false);
  assert.equal(ladderDecision({ intent: "complaint", state: { level: 3, streak: 0, proposedLevel: null }, requiresHuman: false, factIssueCount: 0 }).wouldAutosend, false, "plafond 1 wint van een opgeslagen trede");
  assert.equal(ladderDecision({ intent: "order_status", state: null, requiresHuman: false, factIssueCount: 0 }).wouldAutosend, false);
});

test("pipeline: ladder standaard in schaduw, beslist alleen met de schakelaar", async () => {
  const { readFileSync } = await import("node:fs");
  const pipeline = readFileSync(new URL("../lib/pipeline/runInboundEmailPipeline.ts", import.meta.url), "utf8");
  assert.match(pipeline, /ladderMode = input\.runtime\.config\.trustLadderEnabled \? "enforce" as const : "shadow" as const/);
  assert.match(pipeline, /ladderMode === "enforce"\s*\n\s*\/\/[^\n]*\n\s*\? ladder\.wouldAutosend && decision\.confidence >= 0\.6/);
  assert.match(pipeline, /ladder: \{ mode: ladderMode, \.\.\.ladder \}/);
  const runtime = readFileSync(new URL("../lib/tenants/loadTenantRuntime.ts", import.meta.url), "utf8");
  assert.match(runtime, /trustLadderEnabled: cfg\?\.trust_ladder_enabled === true/);
});
