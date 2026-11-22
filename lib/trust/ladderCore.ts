/**
 * Vertrouwensladder (docs/plan-werkstroomkern.md, fase 3). Autonomie hoort bij
 * een winkel plus een soort vraag, niet bij een agent, en wordt verdiend met een
 * gemeten reeks. Puur, zonder aliasimports: de cron, de pipeline en de tests
 * gebruiken dezelfde regels.
 *
 * Tredes: 1 = concept ter goedkeuring, 2 = versturen op het vaste moment met veto,
 * 3 = direct versturen en melden.
 */
import { normalizedEditDistance, normalizeLearningText } from "../agentProfile/learning.ts";

export type TrustLevel = 1 | 2 | 3;
export type TrustState = { level: TrustLevel; streak: number; proposedLevel: TrustLevel | null };
export type ApprovalOutcome = "unchanged" | "edited" | "corrected";
export type LadderChange = "streak" | "reset" | "demoted" | "promotion_proposed";

/** Ongewijzigde goedkeuringen op rij voordat een hogere trede wordt voorgesteld. Startwaarde. */
export const PROMOTION_STREAK = 30;
/** Tot deze mate van aanpassing telt een goedkeuring als ongewijzigd (handtekening, witruimte). */
export const UNCHANGED_MAX_DISTANCE = 0.05;

const CEILINGS: Record<string, TrustLevel> = {
  order_status: 3,
  shipping: 3,
  product_question: 3,
  compliment: 3,
  return_request: 2,
  missing_items: 2,
  damaged: 2,
  warranty: 2,
  // complaint, cancellation, payment, invoice, fallback en alles van de poortwachter: trede 1.
};

export const INITIAL_STATE: TrustState = { level: 1, streak: 0, proposedLevel: null };

export function ceilingFor(intent: string | null | undefined): TrustLevel {
  return CEILINGS[String(intent ?? "")] ?? 1;
}

/**
 * Hoe telt een goedkeuring door een mens? `classification` komt van learn-from-edits
 * (fact | policy | tone | structure | other) en ontbreekt bij een ongewijzigd concept.
 */
export function classifyApproval(aiDraft: string, sentBody: string, classification?: string | null): ApprovalOutcome {
  const distance = normalizedEditDistance(normalizeLearningText(aiDraft), normalizeLearningText(sentBody));
  if (distance <= UNCHANGED_MAX_DISTANCE) return "unchanged";
  return classification === "fact" || classification === "policy" ? "corrected" : "edited";
}

export function applyApproval(state: TrustState, outcome: ApprovalOutcome, intent: string): { state: TrustState; change: LadderChange } {
  if (outcome === "corrected") {
    return { state: { level: 1, streak: 0, proposedLevel: null }, change: state.level > 1 ? "demoted" : "reset" };
  }
  if (outcome === "edited") {
    return { state: { ...state, streak: 0, proposedLevel: null }, change: "reset" };
  }
  const streak = state.streak + 1;
  const ceiling = ceilingFor(intent);
  if (streak >= PROMOTION_STREAK && state.level < ceiling && state.proposedLevel === null) {
    return { state: { ...state, streak, proposedLevel: (state.level + 1) as TrustLevel }, change: "promotion_proposed" };
  }
  return { state: { ...state, streak }, change: "streak" };
}

/** De winkelier zegt ja op het voorstel. */
export function acceptPromotion(state: TrustState, intent: string): TrustState {
  if (state.proposedLevel === null) return state;
  return { level: Math.min(state.proposedLevel, ceilingFor(intent)) as TrustLevel, streak: 0, proposedLevel: null };
}

export type LadderDecision = { intent: string; level: TrustLevel; ceiling: TrustLevel; wouldAutosend: boolean; reason: string };

/**
 * Zou de ladder dit concept zelf laten versturen? Alleen op trede 2 of hoger, binnen het
 * plafond, zonder vondsten van de feitencheck en als het model zelf geen mens vraagt.
 */
export function ladderDecision(input: { intent: string; state: TrustState | null; requiresHuman: boolean; factIssueCount: number }): LadderDecision {
  const ceiling = ceilingFor(input.intent);
  const level = Math.min(input.state?.level ?? 1, ceiling) as TrustLevel;
  const base = { intent: input.intent, level, ceiling };
  if (level < 2) return { ...base, wouldAutosend: false, reason: `trede ${level}: concept ter goedkeuring` };
  if (input.requiresHuman) return { ...base, wouldAutosend: false, reason: "model vraagt een mens" };
  if (input.factIssueCount > 0) return { ...base, wouldAutosend: false, reason: "feitencheck vond iets" };
  return { ...base, wouldAutosend: true, reason: `trede ${level}: zelf versturen` };
}
