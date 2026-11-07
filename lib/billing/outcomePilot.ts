/** Pilot only. Never use this estimate to charge a payment provider. */
export const OUTCOME_PILOT = {
  version: "2026-11-05-pilot",
  currency: "EUR",
  mode: "shadow",
  outcomeCents: 97,
  observationHours: 72,
  trialDays: 14,
  trialOutcomeLimit: 50,
  plans: { starter: 4700, growth: 14700, scale: 29700 },
} as const;

export type PilotPlan = keyof typeof OUTCOME_PILOT.plans;

/** One customer issue, not one email or person. Evidence must be scoped to the workspace. */
export type OutcomeCandidate = {
  workspaceId: string;
  caseId: string;
  lastSubstantiveReplyAt: string | null;
  replyKind: "ai_assisted" | "ai_autonomous" | "manual" | "acknowledgement" | "question";
  delivery: "sent" | "draft" | "failed";
  status: "resolved" | "open" | "escalated" | "spam";
  resolutionReview: "confirmed" | "unverified" | "rejected";
  /** A review applies to this exact reply; regenerating/sending requires a fresh review. */
  reviewedReplyAt: string | null;
  lastCustomerMessageAt: string | null;
  /** Complete visibility includes replies sent outside Support One. */
  visibility: "complete" | "incomplete";
  observedThrough: string | null;
  previouslyCounted: boolean;
};

export type OutcomeDecision = {
  eligible: boolean;
  reason: string;
  eligibleAt: string | null;
};

function timestamp(value: string | null): number {
  // Reject local dates: the 72-hour window is elapsed time, independent of DST.
  if (!value || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  return Date.parse(value);
}

export function assessPilotOutcome(candidate: OutcomeCandidate, now: Date): OutcomeDecision {
  const no = (reason: string, eligibleAt: string | null = null): OutcomeDecision => ({ eligible: false, reason, eligibleAt });
  const current = now.getTime();
  if (!Number.isFinite(current) || !candidate.workspaceId.trim() || !candidate.caseId.trim()) return no("invalid_evidence");
  if (candidate.previouslyCounted) return no("already_counted");
  if (candidate.status !== "resolved") return no(`case_${candidate.status}`);
  if (candidate.delivery !== "sent") return no("reply_not_sent");
  if (!["ai_assisted", "ai_autonomous"].includes(candidate.replyKind)) return no("no_substantive_ai_reply");
  const sent = timestamp(candidate.lastSubstantiveReplyAt);
  const reviewed = timestamp(candidate.reviewedReplyAt);
  if (!Number.isFinite(sent) || sent > current) return no("invalid_reply_date");
  if (candidate.resolutionReview !== "confirmed" || reviewed !== sent) return no("resolution_not_verified");
  if (candidate.visibility !== "complete") return no("incomplete_mail_visibility");
  if (candidate.lastCustomerMessageAt !== null) {
    const inbound = timestamp(candidate.lastCustomerMessageAt);
    if (!Number.isFinite(inbound) || inbound > current) return no("invalid_customer_date");
    // Conservative: even a thank-you needs review, never infer resolution from silence.
    if (inbound >= sent) return no("customer_followup_needs_review");
  }
  const eligible = sent + OUTCOME_PILOT.observationHours * 60 * 60 * 1000;
  const eligibleAt = new Date(eligible).toISOString();
  if (current < eligible) return no("observation_window", eligibleAt);
  const observed = timestamp(candidate.observedThrough);
  if (!Number.isFinite(observed) || observed < eligible || observed > current) return no("observation_incomplete", eligibleAt);
  return { eligible: true, reason: "verified_pilot_outcome", eligibleAt };
}

export function estimatePilotMonth(plan: PilotPlan, outcomes: number) {
  if (!Object.hasOwn(OUTCOME_PILOT.plans, plan)) throw new Error("Unknown pilot plan");
  if (!Number.isSafeInteger(outcomes) || outcomes < 0) throw new Error("Outcomes must be a non-negative integer");
  const baseCents = OUTCOME_PILOT.plans[plan];
  const usageCents = outcomes * OUTCOME_PILOT.outcomeCents;
  const totalCents = baseCents + usageCents;
  if (!Number.isSafeInteger(totalCents)) throw new Error("Estimate exceeds safe integer range");
  return { mode: OUTCOME_PILOT.mode, currency: OUTCOME_PILOT.currency, baseCents, usageCents, totalCents, excludesVat: true };
}

/** Duplicate or cross-workspace input is rejected, not silently added to a bill. */
export function buildPilotReport(workspaceId: string, candidates: OutcomeCandidate[], plan: PilotPlan, now: Date) {
  const seen = new Set<string>();
  const decisions = candidates.map((candidate) => {
    if (candidate.workspaceId !== workspaceId) throw new Error("Workspace mismatch");
    if (seen.has(candidate.caseId)) throw new Error("Duplicate case: reconcile evidence first");
    seen.add(candidate.caseId);
    return { caseId: candidate.caseId, ...assessPilotOutcome(candidate, now) };
  });
  const eligibleCount = decisions.filter((decision) => decision.eligible).length;
  return { workspaceId, version: OUTCOME_PILOT.version, evaluatedAt: now.toISOString(), decisions, eligibleCount,
    estimate: estimatePilotMonth(plan, eligibleCount), chargeCents: 0 };
}
