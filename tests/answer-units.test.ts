import assert from "node:assert/strict";
import { test } from "node:test";
import { countAnswerUnits, type UsageDecision } from "../lib/billingPlans.ts";

const draft = (overrides: Partial<UsageDecision>): UsageDecision => ({
  source_message_id: "m1", conversation_id: "c1", decision: "inform_customer", model: "gpt-4.1-mini", has_draft: true, ...overrides,
});

test("regenerating a draft for the same customer message counts once", () => {
  assert.equal(countAnswerUnits([draft({}), draft({}), draft({ decision: "ask_question" })], new Set()), 1);
});

test("a follow-up message in the same conversation counts again", () => {
  assert.equal(countAnswerUnits([draft({}), draft({ source_message_id: "m2" })], new Set()), 2);
});

test("ignored mail, fallback replies, empty drafts and missing sources do not count", () => {
  assert.equal(countAnswerUnits([
    draft({ decision: "ignore" }),
    draft({ source_message_id: "m2", model: "system-fallback" }),
    draft({ source_message_id: "m3", has_draft: false }),
    draft({ source_message_id: null }),
  ], new Set()), 0);
});

test("excluded conversations (ignored or refunded spam) do not count", () => {
  assert.equal(countAnswerUnits([draft({}), draft({ source_message_id: "m2", conversation_id: "c2" })], new Set(["c1"])), 1);
});

test("a draft without a model name still counts", () => {
  assert.equal(countAnswerUnits([draft({ model: null })], new Set()), 1);
});
