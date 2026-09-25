export type ShopifyAccessToken = {
  access_token: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  associated_user?: { id: number; account_owner: boolean };
  associated_user_scope?: string;
};

export async function requestShopifyToken(
  shop: string,
  credentials: { clientId: string; secret: string },
  grant: { idToken: string; kind: "online" | "offline" } | { refreshToken: string },
  request: typeof fetch = fetch,
): Promise<ShopifyAccessToken> {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new Error("Invalid Shopify domain");
  const body = new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.secret });
  if ("refreshToken" in grant) {
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", grant.refreshToken);
  } else {
    body.set("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange");
    body.set("subject_token", grant.idToken);
    body.set("subject_token_type", "urn:ietf:params:oauth:token-type:id_token");
    body.set("requested_token_type", `urn:shopify:params:oauth:token-type:${grant.kind}-access-token`);
    if (grant.kind === "offline") body.set("expiring", "1");
  }
  const response = await request(`https://${shop}/admin/oauth/access_token`, {
    method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  // Never expose upstream payloads: they can contain credentials or personal data.
  if (!response.ok) throw new Error(`Shopify authorization failed (${response.status})`);
  const token = await response.json() as ShopifyAccessToken;
  if (typeof token.access_token !== "string" || !token.access_token ||
      !Number.isFinite(token.expires_in) || token.expires_in <= 0 || typeof token.scope !== "string") {
    throw new Error("Shopify returned an invalid access token");
  }
  const scopes = token.scope.split(",").map(x => x.trim());
  if (!scopes.includes("read_orders") || scopes.some(scope => scope !== "read_orders")) {
    throw new Error("Shopify public app requires only read_orders access");
  }
  if (("refreshToken" in grant || grant.kind === "offline") &&
      (!token.refresh_token || !Number.isFinite(token.refresh_token_expires_in) || token.refresh_token_expires_in! <= 0)) {
    throw new Error("Shopify did not return an expiring offline token");
  }
  return token;
}
