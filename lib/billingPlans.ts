export type Plan = "trial" | "starter" | "pro" | "agency" | "custom" | "expired";

export type PlanLimits = {
  emails: number;
  inboxes: number;
  members: number;
  docs: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial:   { emails: 150,      inboxes: 1,        members: 1,        docs: 10       },
  starter: { emails: 250,      inboxes: 1,        members: 2,        docs: 25       },
  pro:     { emails: 750,      inboxes: 1,        members: 5,        docs: 100      },
  agency:  { emails: 2000,     inboxes: 1,        members: Infinity, docs: Infinity },
  custom:  { emails: Infinity, inboxes: Infinity, members: Infinity, docs: Infinity },
  expired: { emails: 0,        inboxes: 0,        members: 0,        docs: 0        },
};

export const ANALYTICS_PLANS: Plan[] = ["pro", "agency", "custom", "trial"];
export const AUTO_SEND_PLANS: Plan[] = ["pro", "agency", "custom"];
