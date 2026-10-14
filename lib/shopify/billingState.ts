export type ShopifySubscription = {
  shop: { id: string; myshopifyDomain: string };
  trialEndsAt: string | null;
  currentBillingCycle: { startTime: string; endTime: string } | null;
  items: Array<{ handle: string; price: { active: boolean } }>;
};
export type ShopifyPaidPlan = "starter" | "pro" | "agency";
// Trial length set in Shopify App Pricing; only used to date the usage period during a trial.
const SHOPIFY_TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
export function resolveShopifySubscription(subscription: ShopifySubscription | null, shop: string, handles: Record<string, ShopifyPaidPlan>, now = Date.now()) {
  if (!subscription) return { plan: "expired" as const, trialEndsAt: null, billingPeriodStart: new Date(now).toISOString() };
  if (subscription.shop.myshopifyDomain !== shop) throw new Error("Shopify subscription shop mismatch");
  // `price.active` only says whether the price is still the current list price:
  // a merchant who subscribed before a price change keeps the plan.
  const plans = [...new Set(subscription.items.map(item => handles[item.handle]).filter(Boolean))];
  if (plans.length !== 1) throw new Error(`Unsupported Shopify subscription plan (${subscription.items.map(item => item.handle).join(", ") || "no items"})`);
  const trialEnd = subscription.trialEndsAt ? Date.parse(subscription.trialEndsAt) : NaN;
  if (Number.isFinite(trialEnd) && trialEnd > now) {
    // During a trial Shopify has no billing cycle yet; the trial is the usage period.
    return { plan: "trial" as const, trialEndsAt: subscription.trialEndsAt, billingPeriodStart: new Date(Math.min(now, trialEnd - SHOPIFY_TRIAL_MS)).toISOString() };
  }
  const cycle = subscription.currentBillingCycle;
  if (!cycle || !Number.isFinite(Date.parse(cycle.startTime)) || !Number.isFinite(Date.parse(cycle.endTime)) || Date.parse(cycle.endTime) <= now) {
    throw new Error("Shopify billing cycle is unavailable");
  }
  return { plan: plans[0], trialEndsAt: null, billingPeriodStart: cycle.startTime };
}

