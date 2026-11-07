/** Annual prepayment discounts the base fee only; usage and allowances stay monthly. */
export type BillingInterval = "month" | "year";
export const ANNUAL_DISCOUNT_PERCENT = 20;
export function annualBaseCents(monthlyCents: number) {
  return Math.round(monthlyCents * 12 * (100 - ANNUAL_DISCOUNT_PERCENT) / 100);
}
export function basePriceEnvKey(plan: string, interval: BillingInterval) {
  const key = { starter: "STARTER", pro: "PRO", agency: "AGENCY" }[plan];
  return key ? `STRIPE_PRICE_${key}${interval === "year" ? "_ANNUAL" : ""}` : null;
}
