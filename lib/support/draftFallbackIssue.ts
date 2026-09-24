export type DraftFallbackIssue = "billing" | "configuration" | "rate_limit" | "unknown";

// Older decisions kept the provider's raw error in `reasons`. New decisions
// store a short issue code; both need to explain the fallback to reviewers.
export function draftFallbackIssue(reasons: string[]): DraftFallbackIssue | null {
  const reason = reasons.find((item) => item.startsWith("AI draft fallback used:"));
  if (!reason) return null;

  const detail = reason.toLowerCase();
  if (/billing|no credits remaining|insufficient_quota|credit_balance_exhausted/.test(detail)) return "billing";
  if (/configuration|invalid_api_key|api_key is missing|\b401\b/.test(detail)) return "configuration";
  if (/rate_limit|\b429\b/.test(detail)) return "rate_limit";
  return "unknown";
}
