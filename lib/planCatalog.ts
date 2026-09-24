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
  // De ids blijven starter/pro/agency (Stripe-prijzen en bestaande accounts); de namen volgen het nieuwe model.
  { id: "starter", name: "Starter", price: 49, recommended: false, description: { nl: "Voor webshops tot zo'n 50 bestellingen per dag", en: "For stores up to about 50 orders a day" }, features: { nl: ["100 antwoordconcepten per maand", "1 supportmailbox", "2 teamleden", "Antwoordconcepten ter beoordeling"], en: ["100 reply drafts per month", "1 support mailbox", "2 team members", "Reply drafts for review"] } },
  { id: "pro", name: "Growth", price: 129, recommended: true, description: { nl: "Voor groeiende webshops", en: "For growing stores" }, features: { nl: ["400 antwoordconcepten per maand", "1 supportmailbox", "5 teamleden", "Automatisch versturen", "Inzicht en Sefi"], en: ["400 reply drafts per month", "1 support mailbox", "5 team members", "Automatic sending", "Insights and Sefi"] } },
  { id: "agency", name: "Scale", price: 299, recommended: false, description: { nl: "Voor grote webshops en hoge volumes", en: "For large stores and high volumes" }, features: { nl: ["1.200 antwoordconcepten per maand", "1 supportmailbox", "Onbeperkt teamleden", "Automatisch versturen", "Prioriteitsondersteuning"], en: ["1,200 reply drafts per month", "1 support mailbox", "Unlimited team members", "Automatic sending", "Priority support"] } },
];

export function isPaidPlan(plan: string): plan is PaidPlanId | "custom" {
  return ["starter", "pro", "agency", "custom"].includes(plan);
}

/**
 * De naam die klanten zien. Intern blijven de ids starter/pro/agency
 * (Stripe-koppelingen en bestaande accounts); in beeld heten ze Starter,
 * Growth en Scale.
 */
export function planDisplayName(plan: string | null | undefined, language: "nl" | "en" = "nl") {
  if (!plan) return "—";
  if (plan === "trial") return language === "nl" ? "Proef" : "Trial";
  if (plan === "expired") return language === "nl" ? "Verlopen" : "Expired";
  if (plan === "custom") return language === "nl" ? "Maatwerk" : "Custom";
  return PAID_PLAN_CATALOG.find((item) => item.id === plan)?.name ?? plan.charAt(0).toUpperCase() + plan.slice(1);
}
