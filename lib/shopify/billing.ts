import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getShopifyOfflineAccess } from "@/lib/shopify/installations";
import { resolveShopifySubscription, type ShopifyPaidPlan, type ShopifySubscription } from "@/lib/shopify/billingState";

export async function getShopifyBilling(tenantId: string) {
  if (process.env.SHOPIFY_PUBLIC_APP_ENABLED !== "true") return null;
  const db = getSupabaseAdmin();
  const { data: install, error } = await db.from("shopify_installations").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new Error("Could not check Shopify billing ownership");
  if (!install) return null;
  if (install.status !== "active") return { plan: "expired" as const, trialEndsAt: null, billingPeriodStart: new Date().toISOString() };
  if (install.billing_checked_at && Date.parse(install.billing_checked_at) > Date.now() - 60000 && install.billing_plan) {
    return { plan: install.billing_plan as ShopifyPaidPlan | "trial" | "expired", trialEndsAt: install.billing_trial_ends_at as string | null, billingPeriodStart: String(install.billing_period_start) };
  }
  try {
    return await refreshShopifyBilling(install);
  } catch (refreshError) {
    // A Partner API hiccup must not change what the shop may do: fall back to
    // the last verified status. Without one there is nothing safe to assume.
    if (install.billing_plan) {
      console.error("[shopify/billing] using last verified plan", refreshError instanceof Error ? refreshError.message : refreshError);
      return { plan: install.billing_plan as ShopifyPaidPlan | "trial" | "expired", trialEndsAt: install.billing_trial_ends_at as string | null, billingPeriodStart: String(install.billing_period_start) };
    }
    throw refreshError;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshShopifyBilling(install: Record<string, any>) {
  const db = getSupabaseAdmin();
  const org = process.env.SHOPIFY_PARTNER_ORGANIZATION_ID;
  const appId = process.env.SHOPIFY_PARTNER_APP_ID;
  const partnerToken = process.env.SHOPIFY_PARTNER_API_TOKEN;
  if (!org || !/^\d+$/.test(org) || !appId || !/^gid:\/\/shopify\/App\/\d+$/.test(appId) || !partnerToken) throw new Error("Shopify App Pricing is not configured");
  let shopId = install.shop_id as string | null;
  if (!shopId) {
    const { accessToken } = await getShopifyOfflineAccess(install.shop_domain);
    const response = await fetch(`https://${install.shop_domain}/admin/api/2026-07/graphql.json`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify({ query: "{ shop { id } }" }), cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || result.errors || !result.data?.shop?.id) throw new Error("Could not resolve Shopify shop identity");
    shopId = result.data.shop.id;
  }
  const response = await fetch(`https://partners.shopify.com/${org}/api/2026-07/graphql.json`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": partnerToken },
    body: JSON.stringify({ query: "query($appId: ID!, $shopId: ID!) { activeSubscription(appId: $appId, shopId: $shopId) { shop { id myshopifyDomain } trialEndsAt currentBillingCycle { startTime endTime } items { handle price { active } } } }", variables: { appId, shopId } }),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || result.errors || !result.data || !("activeSubscription" in result.data)) throw new Error("Shopify subscription could not be verified");
  const handles: Record<string, ShopifyPaidPlan> = {
    [process.env.SHOPIFY_STARTER_ITEM_HANDLE ?? "starter"]: "starter",
    [process.env.SHOPIFY_GROWTH_ITEM_HANDLE ?? "growth"]: "pro",
    [process.env.SHOPIFY_SCALE_ITEM_HANDLE ?? "scale"]: "agency",
  };
  const state = resolveShopifySubscription(result.data.activeSubscription as ShopifySubscription | null, install.shop_domain, handles);
  const { error: saveError } = await db.from("shopify_installations").update({ shop_id: shopId, billing_plan: state.plan, billing_trial_ends_at: state.trialEndsAt, billing_period_start: state.billingPeriodStart, billing_checked_at: new Date().toISOString() }).eq("shop_domain", install.shop_domain).eq("status", "active");
  if (saveError) throw new Error("Could not persist Shopify subscription");
  return state;
}
