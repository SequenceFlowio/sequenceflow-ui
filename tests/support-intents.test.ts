import assert from "node:assert/strict";
import test from "node:test";

import { normalizeIntent, SUPPORT_INTENTS } from "../lib/ai/decision/intents.ts";
import { extractJsonObject, validateDecision } from "../lib/ai/decision/validateDecision.ts";

test("soorten vraag: de vaste lijst blijft zoals hij is", () => {
  for (const intent of SUPPORT_INTENTS) assert.equal(normalizeIntent(intent), intent);
  assert.equal(normalizeIntent("non_customer_supplier"), "non_customer_supplier");
});

test("soorten vraag: vrije tekst uit de historie wordt vertaald", () => {
  const cases: Array<[string, string]> = [
    ["order_status_inquiry", "order_status"], ["order status inquiry", "order_status"], ["vraag levertijd bestelling", "order_status"],
    ["order_tracking", "order_status"], ["report_damaged_product", "damaged"], ["damaged_item", "damaged"],
    ["klacht lekkend pompje", "complaint"], ["order_cancellation_request", "cancellation"], ["annuleren bestelling", "cancellation"],
    ["dubbele afschrijving melden", "payment"], ["vraag over retourneren van geopend voer", "return_request"],
    ["resolve_missing_item", "missing_items"], ["vraag garantie", "warranty"], ["thank_customer", "compliment"],
    ["voerabonnement pauzeren", "product_question"], ["inform_customer", "fallback"], ["", "fallback"], ["general", "fallback"],
  ];
  for (const [raw, expected] of cases) assert.equal(normalizeIntent(raw), expected, raw);
});

test("validateDecision geeft altijd een soort uit de lijst", () => {
  const decision = validateDecision(extractJsonObject('{"intent":"vraag levertijd tafel op maat","decision":"inform_customer","requires_human":false,"draft":{"body":"x","language":"nl"}}'));
  assert.equal(decision.intent, "order_status");
  assert.equal(validateDecision({}).intent, "fallback");
});
