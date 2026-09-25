import { shopifyPublicConfig, assertShopifyShopAllowed } from "@/lib/shopify/config";
import { verifyShopifySessionToken } from "@/lib/shopify/sessionToken";
import { requestShopifyToken } from "@/lib/shopify/tokenExchange";
import { AuthorizationError } from "@/lib/auth/authorization";

export async function authenticateShopify(req: Request) {
  const credentials = shopifyPublicConfig();
  const bearer = req.headers.get("authorization") ?? "";
  if (!bearer.startsWith("Bearer ")) throw new AuthorizationError("Not authenticated", 401);
  const idToken = bearer.slice(7);
  let identity;
  try { identity = verifyShopifySessionToken(idToken, credentials); }
  catch { throw new AuthorizationError("Not authenticated", 401); }
  assertShopifyShopAllowed(identity.shop);
  // An ID token proves identity, not staff permissions. Revalidate online access.
  const online = await requestShopifyToken(identity.shop, credentials, { idToken, kind: "online" });
  if (String(online.associated_user?.id) !== identity.subject ||
      !online.associated_user_scope?.split(",").map(x => x.trim()).some(x => x === "read_orders" || x === "write_orders")) {
    throw new AuthorizationError("Shopify order access is required", 403);
  }
  return { ...identity, idToken, role: online.associated_user?.account_owner === true ? "admin" : "agent" };
}
