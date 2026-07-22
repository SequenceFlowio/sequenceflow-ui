import type { Plan } from "./billingPlans";

export type PaidPlanId = Extract<Plan, "starter" | "pro" | "agency">;

export const PAID_PLAN_CATALOG: Array<{
  id: PaidPlanId;
  name: string;
  price: number;
  recommended: boolean;
  description: { nl: string; en: string };
  features: { nl: string[]; en: string[] };
}> = [
  { id: "starter", name: "Starter", price: 39, recommended: false, description: { nl: "Voor kleine teams", en: "For small teams" }, features: { nl: ["250 e-mails per maand", "1 supportmailbox", "2 teamleden", "AI-concepten ter goedkeuring"], en: ["250 emails per month", "1 support mailbox", "2 team members", "AI drafts for approval"] } },
  { id: "pro", name: "Pro", price: 99, recommended: true, description: { nl: "Voor groeiende teams", en: "For growing teams" }, features: { nl: ["750 e-mails per maand", "1 supportmailbox", "5 teamleden", "Auto-send", "Volledige analytics"], en: ["750 emails per month", "1 support mailbox", "5 team members", "Auto-send", "Full analytics"] } },
  { id: "agency", name: "Agency", price: 299, recommended: false, description: { nl: "Voor grote teams en bureaus", en: "For large teams and agencies" }, features: { nl: ["2.000 e-mails per maand", "1 supportmailbox", "Onbeperkte teamleden", "Auto-send", "Prioriteitsondersteuning"], en: ["2,000 emails per month", "1 support mailbox", "Unlimited team members", "Auto-send", "Priority support"] } },
];

export function isPaidPlan(plan: string): plan is PaidPlanId | "custom" {
  return ["starter", "pro", "agency", "custom"].includes(plan);
}
