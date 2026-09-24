export type Plan = "trial" | "starter" | "pro" | "agency" | "custom" | "expired";

export type PlanLimits = {
  /** Antwoordconcepten voor echte klantvragen per periode. */
  aiAnswers: number;
  inboxes: number;
  members: number;
  docs: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial:   { aiAnswers: 150,      inboxes: 1,        members: 1,        docs: 10       },
  // Getoond als Starter, Growth en Scale; de ids blijven gelijk voor Stripe en bestaande accounts.
  starter: { aiAnswers: 100,      inboxes: 1,        members: 2,        docs: 25       },
  pro:     { aiAnswers: 400,      inboxes: 1,        members: 5,        docs: 100      },
  agency:  { aiAnswers: 1200,     inboxes: 1,        members: Infinity, docs: Infinity },
  custom:  { aiAnswers: Infinity, inboxes: Infinity, members: Infinity, docs: Infinity },
  expired: { aiAnswers: 0,        inboxes: 0,        members: 0,        docs: 0        },
};

/**
 * Speling boven het pakket: tot 10% extra wordt er nog gewoon geschreven,
 * zodat niemand halverwege een drukke dag stilvalt. Daarna stopt het.
 */
export const USAGE_GRACE_RATIO = 0.1;

export function usageHardLimit(limit: number) {
  // Afronden vóór ceil: 100 * 1.1 is in floating point net iets boven 110.
  return Number.isFinite(limit) ? Math.ceil(Math.round(limit * (1 + USAGE_GRACE_RATIO) * 1e6) / 1e6) : limit;
}

export const ANALYTICS_PLANS: Plan[] = ["pro", "agency", "custom", "trial"];
export const AUTO_SEND_PLANS: Plan[] = ["pro", "agency", "custom"];
export const PAIN_POINT_PLANS: Plan[] = ["pro", "agency", "custom"];
