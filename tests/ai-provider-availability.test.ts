import assert from "node:assert/strict";
import test from "node:test";

import { aiProviderIssueMessage, classifyAiProviderIssue } from "../lib/ai/providerAvailability.ts";

test("AI provider errors distinguish exhausted credit from temporary rate limits", () => {
  assert.equal(classifyAiProviderIssue({ status: 429, code: "credit_balance_exhausted" }), "billing");
  assert.equal(classifyAiProviderIssue({ status: 429, code: "insufficient_quota" }), "billing");
  assert.equal(classifyAiProviderIssue({ status: 429, code: "rate_limit_exceeded" }), "rate_limit");
  assert.equal(classifyAiProviderIssue({ status: 401, code: "invalid_api_key" }), "configuration");
  assert.equal(classifyAiProviderIssue({ status: 503, message: "database unavailable" }), null);
  assert.match(aiProviderIssueMessage("billing", "nl"), /API-tegoed/);
  assert.match(aiProviderIssueMessage("billing", "en"), /API credit/);
});
