import assert from "node:assert/strict";
import test from "node:test";

import { aiCreditUsage } from "../lib/ai/usageMath.ts";
import { spamRefundPolicy } from "../lib/ai/spamProtectionPolicy.ts";

test("AI credits weight output and cached input without producing zero-cost generations", () => {
  assert.deepEqual(aiCreditUsage({
    prompt_tokens: 2000,
    completion_tokens: 500,
    prompt_tokens_details: { cached_tokens: 1000 },
  }), {
    promptTokens: 2000,
    cachedInputTokens: 1000,
    completionTokens: 500,
    weightedTokens: 2750,
    credits: 3,
  });
});

test("spam refunds stay automatic for normal use and require review for abnormal rates", () => {
  assert.equal(spamRefundPolicy({ processedCases: 4, priorHumanSpamFlags: 3 }).eligible, true);
  assert.equal(spamRefundPolicy({ processedCases: 40, priorHumanSpamFlags: 9 }).eligible, true);

  const suspiciousBurst = spamRefundPolicy({ processedCases: 5, priorHumanSpamFlags: 4 });
  assert.equal(suspiciousBurst.eligible, false);
  assert.equal(suspiciousBurst.requiresReview, true);

  const suspicious = spamRefundPolicy({ processedCases: 20, priorHumanSpamFlags: 10 });
  assert.equal(suspicious.eligible, false);
  assert.equal(suspicious.requiresReview, true);
  assert.equal(suspicious.reason, "unusually_high_human_spam_rate");
});
