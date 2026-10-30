import type { Plan } from "@/lib/billingPlans";

/**
 * Accounts that get a plan without paying, on their own workspace. Scale is
 * "agency" internally.
 */
const PLAN_WHITELIST: Record<string, Exclude<Plan, "trial" | "expired">> = {
  "sequenceflownl@gmail.com": "agency",
  "deadtheon@gmail.com": "agency",
};

/** Our own team: may also open the app without a workspace of its own. */
const TEAM_EMAILS = new Set(["sequenceflownl@gmail.com"]);

const PLAN_RANK: Record<Plan, number> = { expired: 0, trial: 1, starter: 2, pro: 3, agency: 4, custom: 5 };

export function whitelistedPlan(email?: string | null): Plan | null {
  if (!email) return null;
  return PLAN_WHITELIST[email.trim().toLowerCase()] ?? null;
}

/** The best whitelisted plan among a workspace's members, or null. */
export function bestWhitelistedPlan(emails: Array<string | null | undefined>): Plan | null {
  return emails.reduce<Plan | null>((best, email) => {
    const plan = whitelistedPlan(email);
    return plan && (!best || PLAN_RANK[plan] > PLAN_RANK[best]) ? plan : best;
  }, null);
}

export function isTeamWhitelistedEmail(email?: string | null): boolean {
  return Boolean(email && TEAM_EMAILS.has(email.trim().toLowerCase()));
}
