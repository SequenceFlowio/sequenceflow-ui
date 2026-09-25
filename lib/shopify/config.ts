export function shopifyPublicConfig() {
  if (process.env.SHOPIFY_PUBLIC_APP_ENABLED !== "true") throw new Error("Shopify public app is disabled");
  const clientId = process.env.SHOPIFY_API_KEY?.trim();
  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!clientId || !secret) throw new Error("Shopify app credentials are missing");
  if (process.env.SHOPIFY_PUBLIC_ROLLOUT !== "true") {
    const expected = process.env.SHOPIFY_SANDBOX_SUPABASE_URL?.replace(/\/$/, "");
    const actual = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
    if (!expected || expected !== actual) throw new Error("Shopify pilot requires its isolated Supabase environment");
  }
  return { clientId, secret };
}

export function assertShopifyShopAllowed(shop: string) {
  const allowed = (process.env.SHOPIFY_ALLOWED_SHOPS ?? "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  // Closed pilot by default. Public rollout requires a separate explicit switch.
  if (process.env.SHOPIFY_PUBLIC_ROLLOUT !== "true" && !allowed.includes(shop)) {
    throw new Error("This shop has not been enabled for the Shopify pilot");
  }
}
