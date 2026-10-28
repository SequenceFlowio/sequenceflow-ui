import type { Plan } from "@/lib/billingPlans";

/**
 * Accounts that get a plan without paying. Our own team gets Scale ("agency")
 * and may open the app without a workspace; others get the plan listed here
 * on their own workspace.
 */
const PLAN_WHITELIST: Record<string, Exclude<Plan, "trial" | "expired">> = {
  "sequenceflownl@gmail.com": "agency",
  "deadtheon@gmail.com": "pro",
};

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

export function isAgencyWhitelistedEmail(email?: string | null): boolean {
  return whitelistedPlan(email) === "agency";
}
