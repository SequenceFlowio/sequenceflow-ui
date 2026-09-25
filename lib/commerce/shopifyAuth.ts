export const REQUIRED_SHOPIFY_SCOPES = ["read_orders", "write_orders"] as const;

export function shopifyScopeIssue(scopes: string[], authMode: "oauth" | "client_credentials" = "client_credentials") {
  const normalized = [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
  // The public app (oauth) reads orders only; it never cancels or edits them.
  if (authMode === "oauth") {
    if (!normalized.includes("read_orders")) return "Shopify app is missing scopes: read_orders.";
    const extra = normalized.filter((scope) => scope !== "read_orders");
    return extra.length ? `Shopify app has scopes outside the read-only allowlist: ${extra.join(", ")}.` : null;
  }
  // Shopify omits read_orders from granted scopes when write_orders is present,
  // because the write scope already includes read access.
  if (!normalized.includes("write_orders")) return "Shopify app is missing scopes: write_orders.";
  const extra = normalized.filter((scope) => !REQUIRED_SHOPIFY_SCOPES.includes(scope as typeof REQUIRED_SHOPIFY_SCOPES[number]));
  if (extra.length) return `Shopify app has scopes outside the pilot allowlist: ${extra.join(", ")}.`;
  return null;
}

export function shopifyTokenNeedsRefresh(expiresAt: string | null, now = Date.now()) {
  const expires = expiresAt ? new Date(expiresAt).getTime() : 0;
  return !Number.isFinite(expires) || expires <= now + 5 * 60 * 1000;
}

export function shopifyTokenExpiresAt(expiresIn: unknown, now = Date.now()) {
  const parsed = Number(expiresIn);
  const lifetimeSeconds = Number.isFinite(parsed)
    ? Math.min(86_400, Math.max(300, Math.floor(parsed)))
    : 86_399;
  return new Date(now + lifetimeSeconds * 1000).toISOString();
}
