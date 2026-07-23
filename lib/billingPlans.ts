export type Plan = "trial" | "starter" | "pro" | "agency" | "custom" | "expired";

export type PlanLimits = {
  aiAnswers: number;
  inboxes: number;
  members: number;
  docs: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial:   { aiAnswers: 150,      inboxes: 1,        members: 1,        docs: 10       },
  starter: { aiAnswers: 250,      inboxes: 1,        members: 2,        docs: 25       },
  pro:     { aiAnswers: 750,      inboxes: 1,        members: 5,        docs: 100      },
  agency:  { aiAnswers: 2000,     inboxes: 1,        members: Infinity, docs: Infinity },
  custom:  { aiAnswers: Infinity, inboxes: Infinity, members: Infinity, docs: Infinity },
  expired: { aiAnswers: 0,        inboxes: 0,        members: 0,        docs: 0        },
};

export const ANALYTICS_PLANS: Plan[] = ["pro", "agency", "custom", "trial"];
export const AUTO_SEND_PLANS: Plan[] = ["pro", "agency", "custom"];
export const PAIN_POINT_PLANS: Plan[] = ["pro", "agency", "custom"];
