import { shopifyApiAllowed } from "@/lib/shopify/apiAccess";
import { authenticateShopify } from "@/lib/shopify/authenticate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AuthorizationError } from "@/lib/auth/authorization";

export async function getShopifyTenant(req: Request) {
  const identity = await authenticateShopify(req);
  if (!shopifyApiAllowed(new URL(req.url).pathname, req.method, identity.role)) throw new AuthorizationError("This action is not available in the Shopify pilot", 403);
  const { data, error } = await getSupabaseAdmin().from("shopify_installations")
    .select("tenant_id,status").eq("shop_domain", identity.shop).single();
  if (error || data?.status !== "active" || !data.tenant_id) throw new AuthorizationError("Shopify is not connected", 403);
  return { tenantId: String(data.tenant_id), role: identity.role, userId: null, shopifyUserId: identity.subject, shopifyShop: identity.shop };
}
