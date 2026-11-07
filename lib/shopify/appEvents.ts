/**
 * Afgehandelde gesprekken van Shopify-winkels via Shopify App Pricing
 * afrekenen: per gesprek een billing event naar de App Events API. De meters
 * (handled_assisted $0,47, handled_autonomous $0,97) staan per plan in het
 * Partner-dashboard. Een 202 betekent "ontvangen", niet "gefactureerd";
 * de uitkomst per event staat in de Dev Dashboard-logs.
 */

const TOKEN_URL = "https://api.shopify.com/auth/access_token";
const EVENTS_URL = "https://api.shopify.com/app/unstable/events";
const USER_AGENT = "SequenceFlow-Support/1.0";

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) throw new Error("SHOPIFY_API_KEY/SHOPIFY_API_SECRET missing");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error(`App Events token ${response.status}`);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("App Events token missing");
  // Tokens leven 60 minuten.
  cached = { token: body.access_token, expiresAt: Date.now() + Math.min(body.expires_in ?? 3600, 3600) * 1000 };
  return cached.token;
}

export function shopGid(shopId: string | number) {
  const value = String(shopId);
  return value.startsWith("gid://") ? value : `gid://shopify/Shop/${value}`;
}

export async function reportShopifyUsage(input: { shopId: string | number; handle: "handled_assisted" | "handled_autonomous"; idempotencyKey: string; at?: Date }) {
  const token = await accessToken();
  const response = await fetch(EVENTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
    body: JSON.stringify({
      shop_id: shopGid(input.shopId),
      event_handle: input.handle,
      timestamp: (input.at ?? new Date()).toISOString(),
      idempotency_key: input.idempotencyKey.slice(0, 64),
      attributes: { value: 1 },
    }),
  });
  if (response.status !== 202 && !response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`App Events ${response.status}: ${detail.slice(0, 200)}`);
  }
}
