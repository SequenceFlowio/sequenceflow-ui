import assert from "node:assert/strict";
import test from "node:test";

import { buildDecisionSystemPrompt } from "../lib/ai/decision/buildDecisionPrompt.ts";
import { validateDecision } from "../lib/ai/decision/validateDecision.ts";

const base = {
  intent: "cancel_order",
  confidence: 0.9,
  decision: "inform_customer",
  requires_human: true,
  reasons: ["Explicit request"],
  draft: { subject: "Re: order", body: "We will review this request.", language: "en" },
};

test("decision action validation keeps supported shapes and drops manipulated actions", () => {
  const decision = validateDecision({
    ...base,
    actions: [
      { type: "cancel_order", payload: { orderId: "internal-order", refundAmount: 999999 } },
      { type: "refund_order", payload: { orderId: "attacker-order" } },
      { type: "escalate", payload: { department: "finance" } },
      { type: "cancel_order", payload: "not-an-object" },
    ],
  });
  assert.deepEqual(decision.actions, [
    { type: "cancel_order", payload: { orderId: "internal-order" } },
    { type: "cancel_order", payload: undefined },
  ]);
});

test("non-Shopify tenants keep the legacy decision prompt contract", () => {
  const runtime = {
    templates: [],
    config: {
      escalationDepartments: [], languageDefault: "nl", empathyEnabled: true,
      allowDiscount: false, maxDiscountAmount: 0, replyTone: "friendly_informal",
      replyPronounPreference: "informal",
    },
  } as never;
  const legacyPrompt = buildDecisionSystemPrompt(runtime, "", "AGENT DNA", "");
  assert.doesNotMatch(legacyPrompt, /Live commerce context/);
  assert.doesNotMatch(legacyPrompt, /cancel_order/);
  assert.doesNotMatch(legacyPrompt, /SOURCE PRIORITY/);
  assert.match(legacyPrompt, /"actions": \[\]/);

  const commercePrompt = buildDecisionSystemPrompt(runtime, "", "AGENT DNA", "COMMERCE CONTEXT");
  assert.match(commercePrompt, /Live commerce context/);
  assert.match(commercePrompt, /cancel_order/);
  assert.match(commercePrompt, /SOURCE PRIORITY/);
});
