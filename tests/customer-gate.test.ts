import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseGateResponse, shouldHoldForGate } from "../lib/pipeline/customerGatePolicy.ts";

test("the gate only holds an email when it is sure it is not a customer question", () => {
  assert.equal(shouldHoldForGate({ isCustomerQuestion: false, category: "supplier", confidence: 0.95, reason: "" }), true);
  assert.equal(shouldHoldForGate({ isCustomerQuestion: false, category: "sales", confidence: 0.84, reason: "" }), false);
  assert.equal(shouldHoldForGate({ isCustomerQuestion: true, category: "customer", confidence: 0.99, reason: "" }), false);
  assert.equal(shouldHoldForGate(null), false);
});

test("malformed or unexpected model output lets the email through", () => {
  assert.equal(parseGateResponse("not json"), null);
  assert.equal(parseGateResponse('{"category":"supplier","confidence":0.99}'), null);
  assert.equal(parseGateResponse('{"is_customer_question":false,"category":"supplier","confidence":"high"}'), null);
  assert.equal(parseGateResponse('{"is_customer_question":false,"category":"supplier","confidence":1.4}'), null);
  const unknown = parseGateResponse('{"is_customer_question":false,"category":"weird","confidence":0.9,"reason":"x"}');
  assert.equal(unknown?.category, "other");
  const customer = parseGateResponse('{"is_customer_question":true,"category":"supplier","confidence":0.9}');
  assert.equal(customer?.category, "customer");
  assert.equal(shouldHoldForGate(customer), false);
});

test("the pipeline runs the gate before any drafting and never for bol.com or ongoing conversations", () => {
  const pipeline = readFileSync(new URL("../lib/pipeline/runInboundEmailPipeline.ts", import.meta.url), "utf8");
  const gate = pipeline.indexOf("classifyCustomerQuestion(");
  assert.ok(gate > 0);
  assert.ok(gate < pipeline.indexOf("checkAiAnswerLimit(input.tenantId)"));
  assert.ok(gate < pipeline.indexOf("openai.chat.completions.create"));
  assert.match(pipeline, /!input\.skipCustomerGate && !input\.forceHumanReview && !input\.regenerationInstructions && !alreadyInConversation && !bolCustomerMail/);
  assert.match(pipeline, /skipCustomerGate: true/);
});
