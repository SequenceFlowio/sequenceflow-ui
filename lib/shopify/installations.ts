import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptSecret, decryptSecret } from "@/lib/security/credentials";
import { shopifyPublicConfig, assertShopifyShopAllowed } from "@/lib/shopify/config";
import { requestShopifyToken } from "@/lib/shopify/tokenExchange";
import { hashShopifyLinkCode } from "@/lib/shopify/linkCode";

/** All offline token exchanges and refreshes share the same database lease. */
export async function getShopifyOfflineAccess(shop: string, ownerIdToken?: string) {
  const credentials = shopifyPublicConfig();
  assertShopifyShopAllowed(shop);
  const db = getSupabaseAdmin();
  const lock = randomUUID();
  const { data: claimed, error: claimError } = await db.rpc("claim_shopify_token_lock", { p_shop: shop, p_lock: lock });
  if (claimError) throw new Error("Shopify token storage is unavailable");
  if (!claimed) throw new Error("Shopify connection is updating. Try again shortly.");
  try {
    const { data: install, error } = await db.from("shopify_installations").select("*").eq("shop_domain", shop).single();
    if (error || !install) throw new Error("Shopify installation not found");
    if (install.status !== "active" && !ownerIdToken) throw new Error("The shop owner must open the app first");
    if (install.status === "active" && install.access_token_encrypted && Date.parse(install.access_expires_at) > Date.now() + 60000) {
      return { tenantId: install.tenant_id ? String(install.tenant_id) : null, accessToken: decryptSecret(install.access_token_encrypted) };
    }
    const canRefresh = install.status === "active" && install.refresh_token_encrypted && Date.parse(install.refresh_expires_at) > Date.now() + 60000;
    if (!canRefresh && !ownerIdToken) throw new Error("The shop owner must reconnect Shopify");
    const token = await requestShopifyToken(shop, credentials, canRefresh
      ? { refreshToken: decryptSecret(install.refresh_token_encrypted) }
      : { idToken: ownerIdToken!, kind: "offline" });
    const now = Date.now();
    const { data: tenantId, error: persistError } = await db.rpc("activate_shopify_installation", {
      p_shop: shop, p_lock: lock, p_client_id: credentials.clientId, p_client_secret: encryptSecret(credentials.secret),
      p_access: encryptSecret(token.access_token), p_refresh: encryptSecret(token.refresh_token!),
      p_access_expires: new Date(now + token.expires_in * 1000).toISOString(),
      p_refresh_expires: new Date(now + token.refresh_token_expires_in! * 1000).toISOString(),
    });
    // tenantId is null until the owner chose a workspace (attachShopifyTenant).
    if (persistError) throw new Error("Could not save Shopify installation");
    return { tenantId: tenantId ? String(tenantId) : null, accessToken: token.access_token };
  } finally {
    const { error } = await db.from("shopify_installations").update({ token_lock_id: null, token_lock_until: null }).eq("shop_domain", shop).eq("token_lock_id", lock);
    if (error) console.error("[shopify] Could not release token lease");
  }
}

/**
 * The shop owner's explicit workspace choice. Without a code a new workspace is
 * created; with a code the existing workspace that issued it is linked.
 */
export async function attachShopifyTenant(shop: string, linkCode?: string) {
  const credentials = shopifyPublicConfig();
  assertShopifyShopAllowed(shop);
  const { data, error } = await getSupabaseAdmin().rpc("attach_shopify_tenant", {
    p_shop: shop,
    p_code_hash: linkCode ? hashShopifyLinkCode(linkCode) : null,
    p_client_id: credentials.clientId,
    p_client_secret: encryptSecret(credentials.secret),
  });
  if (error || !data) {
    const message = error?.message ?? "";
    if (/link code/i.test(message)) throw new ShopifyLinkError("Deze koppelcode is ongeldig of verlopen. Maak een nieuwe code aan.");
    if (/already linked/i.test(message)) throw new ShopifyLinkError("Deze werkruimte is al aan een andere Shopify-winkel gekoppeld.");
    throw new Error("Could not attach Shopify workspace");
  }
  return String(data);
}

export class ShopifyLinkError extends Error {}
