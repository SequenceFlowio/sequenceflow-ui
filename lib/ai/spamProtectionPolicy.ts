const MIN_CASE_SAMPLE = 20;
const MIN_SPAM_FLAGS = 10;
const MAX_AUTOMATIC_REFUND_RATE = 0.5;
const BURST_MIN_CASE_SAMPLE = 5;
const BURST_MIN_SPAM_FLAGS = 5;
const BURST_MAX_AUTOMATIC_REFUND_RATE = 0.8;

export function spamRefundPolicy(input: {
  processedCases: number;
  priorHumanSpamFlags: number;
}) {
  const spamFlagsAfterAction = input.priorHumanSpamFlags + 1;
  const rate = spamFlagsAfterAction / Math.max(1, input.processedCases);
  const suspiciousBurst =
    input.processedCases >= BURST_MIN_CASE_SAMPLE &&
    spamFlagsAfterAction >= BURST_MIN_SPAM_FLAGS &&
    rate > BURST_MAX_AUTOMATIC_REFUND_RATE;
  const suspiciousLongTermRate =
    input.processedCases >= MIN_CASE_SAMPLE &&
    spamFlagsAfterAction >= MIN_SPAM_FLAGS &&
    rate > MAX_AUTOMATIC_REFUND_RATE;
  const requiresReview = suspiciousBurst || suspiciousLongTermRate;

  return {
    eligible: !requiresReview,
    requiresReview,
    rate,
    reason: requiresReview ? "unusually_high_human_spam_rate" : "automatic_spam_refund",
  };
}
