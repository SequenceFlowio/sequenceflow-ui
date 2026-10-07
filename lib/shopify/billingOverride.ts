/**
 * Plan overrides for Shopify test, review and pilot stores (pure, unit-tested).
 */
const list = (value: string | undefined) => (value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);

/**
 * Pilot and test stores can be given a plan without Shopify billing:
 * "shop.myshopify.com" means trial, "shop.myshopify.com=pro" a specific plan.
 */
export function billingOverrideForShop(shop: string, value: string | undefined): "trial" | "starter" | "pro" | "agency" | null {
  for (const entry of list(value)) {
    const [domain, plan] = entry.split("=").map((part) => part.trim());
    if (domain !== shop.toLowerCase()) continue;
    if (!plan) return "trial";
    return plan === "starter" || plan === "pro" || plan === "agency" || plan === "trial" ? plan : null;
  }
  return null;
}
