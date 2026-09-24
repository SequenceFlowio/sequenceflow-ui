import assert from "node:assert/strict";
import test from "node:test";

import { draftFallbackIssue } from "../lib/support/draftFallbackIssue.ts";

test("reviewers can distinguish exhausted API credit from a missing order", () => {
  assert.equal(draftFallbackIssue(["AI draft fallback used: 429 You have no credits remaining."]), "billing");
  assert.equal(draftFallbackIssue(["AI draft fallback used: billing"]), "billing");
  assert.equal(draftFallbackIssue(["No matching order was found"]), null);
});

test("fallback errors remain understandable without exposing raw provider details", () => {
  assert.equal(draftFallbackIssue(["AI draft fallback used: configuration"]), "configuration");
  assert.equal(draftFallbackIssue(["AI draft fallback used: rate_limit"]), "rate_limit");
  assert.equal(draftFallbackIssue(["AI draft fallback used: generation_failed"]), "unknown");
});
