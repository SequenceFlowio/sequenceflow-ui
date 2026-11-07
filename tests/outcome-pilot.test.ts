import test from "node:test";
import assert from "node:assert/strict";
import { assessPilotOutcome, buildPilotReport, estimatePilotMonth, type OutcomeCandidate } from "../lib/billing/outcomePilot.ts";

const now = new Date("2026-11-05T12:00:00Z");
const candidate: OutcomeCandidate = {
  workspaceId: "shop-a", caseId: "case-1", lastSubstantiveReplyAt: "2026-11-02T12:00:00Z",
  replyKind: "ai_assisted", delivery: "sent", status: "resolved", resolutionReview: "confirmed",
  reviewedReplyAt: "2026-11-02T12:00:00Z", lastCustomerMessageAt: "2026-11-02T11:00:00Z",
  visibility: "complete", observedThrough: now.toISOString(), previouslyCounted: false,
};

test("only counts after the full 72 hours, including human-approved AI", () => {
  assert.equal(assessPilotOutcome(candidate, new Date(now.getTime() - 1)).eligible, false);
  assert.equal(assessPilotOutcome(candidate, now).eligible, true);
});

test("silence, missing external replies and stale reviews cannot establish resolution", () => {
  for (const change of [
    { resolutionReview: "unverified" }, { visibility: "incomplete" },
    { reviewedReplyAt: "2026-11-01T12:00:00Z" }, { observedThrough: "2026-11-04T12:00:00Z" },
    { lastCustomerMessageAt: "2026-11-03T12:00:00Z" }, { previouslyCounted: true },
  ] as Partial<OutcomeCandidate>[]) assert.equal(assessPilotOutcome({ ...candidate, ...change }, now).eligible, false);
});

test("excludes drafts, failures, manual replies, acknowledgements, questions and escalations", () => {
  for (const change of [
    { delivery: "draft" }, { delivery: "failed" }, { replyKind: "manual" },
    { replyKind: "acknowledgement" }, { replyKind: "question" }, { status: "open" },
    { status: "spam" }, { status: "escalated" },
  ] as Partial<OutcomeCandidate>[]) assert.equal(assessPilotOutcome({ ...candidate, ...change }, now).eligible, false);
});

test("invalid or future evidence fails closed", () => {
  for (const change of [
    { lastSubstantiveReplyAt: "bad" }, { lastSubstantiveReplyAt: "2026-11-02T12:00:00" },
    { observedThrough: "2027-01-01T00:00:00Z" }, { lastCustomerMessageAt: "bad" },
    { caseId: "" },
  ]) assert.equal(assessPilotOutcome({ ...candidate, ...change }, now).eligible, false);
});

test("report never charges and rejects duplicate cases and other workspaces", () => {
  const report = buildPilotReport("shop-a", [candidate], "starter", now);
  assert.equal(report.eligibleCount, 1);
  assert.equal(report.chargeCents, 0);
  assert.equal(report.estimate.totalCents, 4797);
  assert.throws(() => buildPilotReport("shop-b", [candidate], "starter", now), /Workspace/);
  assert.throws(() => buildPilotReport("shop-a", [candidate, candidate], "starter", now), /Duplicate/);
});

test("monthly estimates use integer cents and reject invalid quantities", () => {
  assert.equal(estimatePilotMonth("starter", 100).totalCents, 14400);
  assert.equal(estimatePilotMonth("growth", 500).totalCents, 63200);
  assert.equal(estimatePilotMonth("scale", 0).totalCents, 29700);
  for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => estimatePilotMonth("starter", count));
});
