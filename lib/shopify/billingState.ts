export type ShopifySubscription = {
  shop: { id: string; myshopifyDomain: string };
  trialEndsAt: string | null;
  currentBillingCycle: { startTime: string; endTime: string } | null;
  items: Array<{ handle: string; price: { active: boolean } }>;
};
export type ShopifyPaidPlan = "starter" | "pro" | "agency";
export function resolveShopifySubscription(subscription: ShopifySubscription | null, shop: string, handles: Record<string, ShopifyPaidPlan>, now = Date.now()) {
  if (!subscription) return { plan: "expired" as const, trialEndsAt: null, billingPeriodStart: new Date(now).toISOString() };
  if (subscription.shop.myshopifyDomain !== shop) throw new Error("Shopify subscription shop mismatch");
  const plans = subscription.items.filter(item => item.price.active).map(item => handles[item.handle]).filter(Boolean);
  if (plans.length !== 1) throw new Error("Unsupported Shopify subscription plan");
  const cycle = subscription.currentBillingCycle;
  if (!cycle || !Number.isFinite(Date.parse(cycle.startTime)) || !Number.isFinite(Date.parse(cycle.endTime)) || Date.parse(cycle.endTime) <= now) {
    throw new Error("Shopify billing cycle is unavailable");
  }
  const trial = subscription.trialEndsAt && Date.parse(subscription.trialEndsAt) > now;
  return { plan: trial ? "trial" as const : plans[0], trialEndsAt: trial ? subscription.trialEndsAt : null, billingPeriodStart: cycle.startTime };
}
