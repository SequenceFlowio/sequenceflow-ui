import assert from "node:assert/strict";
import test from "node:test";

import { assessConversation, replyPurpose, summarizePeriod, type ConversationEvidence } from "../lib/billing/handledConversations.ts";

const sent = "2026-11-02T12:00:00.000Z";
const base: ConversationEvidence = {
  conversationId: "c1",
  spam: false,
  replies: [{ sentAt: sent, kind: "ai_assisted", purpose: "answer" }],
  customerMessages: ["2026-11-02T10:00:00.000Z"],
};
const at = (iso: string) => new Date(iso);

test("an answer counts only after 72 hours without the customer coming back", () => {
  assert.equal(assessConversation(base, at("2026-11-05T11:59:59.000Z")).status, "pending");
  const result = assessConversation(base, at("2026-11-05T12:00:00.000Z"));
  assert.equal(result.status, "handled");
  assert.equal("rateCents" in result && result.rateCents, 49);
});

test("a draft, a question back or spam never counts", () => {
  assert.deepEqual(assessConversation({ ...base, replies: [] }, at("2026-11-09T00:00:00Z")), { status: "not_billable", reason: "no_answer_sent" });
  assert.equal(assessConversation({ ...base, replies: [{ sentAt: sent, kind: "ai_assisted", purpose: "question" }] }, at("2026-11-09T00:00:00Z")).status, "not_billable");
  assert.deepEqual(assessConversation({ ...base, spam: true }, at("2026-11-09T00:00:00Z")), { status: "not_billable", reason: "spam" });
  // Antwoorden van vóór de meting (zonder soort) tellen niet.
  assert.equal(assessConversation({ ...base, replies: [{ sentAt: sent, kind: null, purpose: "answer" }] }, at("2026-11-09T00:00:00Z")).status, "not_billable");
});

test("the customer coming back within 72 hours cancels it, even with a thank-you", () => {
  const back = { ...base, customerMessages: [...base.customerMessages, "2026-11-04T09:00:00.000Z"] };
  assert.deepEqual(assessConversation(back, at("2026-11-09T00:00:00Z")), { status: "not_billable", reason: "customer_returned" });
  // Terugkomen na de 72 uur verandert niets meer.
  const late = { ...base, customerMessages: [...base.customerMessages, "2026-11-06T09:00:00.000Z"] };
  assert.equal(assessConversation(late, at("2026-11-09T00:00:00Z")).status, "handled");
});

test("after the customer came back, solving it later counts at most as checked (€0,49)", () => {
  const evidence: ConversationEvidence = {
    ...base,
    replies: [
      { sentAt: sent, kind: "ai_autonomous", purpose: "answer" },
      { sentAt: "2026-11-04T10:00:00.000Z", kind: "ai_autonomous", purpose: "answer" },
    ],
    customerMessages: [...base.customerMessages, "2026-11-04T09:00:00.000Z"],
  };
  const result = assessConversation(evidence, at("2026-11-08T00:00:00Z"));
  assert.equal(result.status, "handled");
  assert.equal("kind" in result && result.kind, "ai_assisted");
  assert.equal("rateCents" in result && result.rateCents, 49);
});

test("an autonomous answer that holds costs €0,99, and a conversation counts once", () => {
  const evidence: ConversationEvidence = {
    ...base,
    replies: [
      { sentAt: sent, kind: "ai_autonomous", purpose: "answer" },
      { sentAt: "2026-11-06T10:00:00.000Z", kind: "ai_assisted", purpose: "answer" },
    ],
  };
  const result = assessConversation(evidence, at("2026-11-10T00:00:00Z"));
  assert.equal(result.status, "handled");
  assert.equal("rateCents" in result && result.rateCents, 99);
  assert.equal("sentAt" in result && result.sentAt, sent);
});

test("a period adds up what became final in it; pending ones are shown apart", () => {
  const now = at("2026-11-10T00:00:00Z");
  const results = [
    assessConversation(base, now),
    assessConversation({ ...base, replies: [{ sentAt: sent, kind: "ai_autonomous", purpose: "answer" }] }, now),
    assessConversation({ ...base, replies: [{ sentAt: "2026-11-09T00:00:00Z", kind: "ai_assisted", purpose: "answer" }] }, now),
  ];
  assert.deepEqual(summarizePeriod(results, { start: at("2026-11-01T00:00:00Z"), end: at("2026-12-01T00:00:00Z") }), { assisted: 1, autonomous: 1, pending: 1, usageCents: 148 });
  assert.equal(summarizePeriod(results, { start: at("2026-12-01T00:00:00Z"), end: at("2027-01-01T00:00:00Z") }).usageCents, 0);
});

test("the AI's own decision tells an answer from a question back", () => {
  assert.equal(replyPurpose("ask_question"), "question");
  assert.equal(replyPurpose("inform_customer"), "answer");
  assert.equal(replyPurpose(null), "answer");
});
