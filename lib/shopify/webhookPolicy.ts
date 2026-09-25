/**
 * Pure rules for processing Shopify webhooks (no I/O, so they are unit-tested).
 */

export const SHOPIFY_WEBHOOK_MAX_ATTEMPTS = 8;
/** A job left in "processing" longer than this is considered crashed and retried. */
export const SHOPIFY_WEBHOOK_STALE_MS = 10 * 60 * 1000;

export const SHOPIFY_ORDER_TOPICS = new Set([
  "orders/create", "orders/updated", "orders/cancelled", "orders/fulfilled", "orders/partially_fulfilled",
]);

export type ShopRedactionPlan = "delete_workspace" | "delete_shopify_data" | "skip_reinstalled" | "nothing_stored";

/**
 * shop/redact arrives 48 hours after uninstall. A workspace that was created for
 * this shop is deleted entirely; an existing workspace that was only linked keeps
 * everything that did not come from Shopify. A shop that was reinstalled in the
 * meantime is left alone.
 */
export function planShopRedaction(install: { status: string; tenant_id: string | null; tenant_origin: string | null } | null): ShopRedactionPlan {
  if (!install) return "nothing_stored";
  if (install.status === "active") return "skip_reinstalled";
  if (!install.tenant_id) return "nothing_stored";
  return install.tenant_origin === "linked" ? "delete_shopify_data" : "delete_workspace";
}

export type CustomerPrivacyPayload = { customerEmail: string | null; orderGids: string[] };

/** customers/data_request and customers/redact carry the customer and the order ids. */
export function parseCustomerPrivacyPayload(payload: unknown): CustomerPrivacyPayload {
  const data = (payload ?? {}) as { customer?: { email?: unknown }; orders_requested?: unknown; orders_to_redact?: unknown };
  const email = typeof data.customer?.email === "string" && data.customer.email.includes("@")
    ? data.customer.email.trim().toLowerCase()
    : null;
  const ids = [...(Array.isArray(data.orders_requested) ? data.orders_requested : []), ...(Array.isArray(data.orders_to_redact) ? data.orders_to_redact : [])];
  const orderGids = [...new Set(ids
    .map((id) => typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id)) ? `gid://shopify/Order/${id}` : null)
    .filter((id): id is string => Boolean(id)))];
  return { customerEmail: email, orderGids };
}

/** Order webhooks: the GraphQL id of the order, or null when the payload is unusable. */
export function parseOrderWebhookGid(payload: unknown): string | null {
  const data = (payload ?? {}) as { admin_graphql_api_id?: unknown; id?: unknown };
  if (typeof data.admin_graphql_api_id === "string" && /^gid:\/\/shopify\/Order\/\d+$/.test(data.admin_graphql_api_id)) {
    return data.admin_graphql_api_id;
  }
  if (typeof data.id === "number" || (typeof data.id === "string" && /^\d+$/.test(data.id))) return `gid://shopify/Order/${data.id}`;
  return null;
}

export const SHOPIFY_LINK_MAX_FAILURES = 10;
export const SHOPIFY_LINK_FAILURE_WINDOW_MS = 60 * 60 * 1000;

/** Failed link-code attempts count per shop within a rolling window. */
export function linkAttemptState(failures: number, since: string | null, now = Date.now()) {
  const windowOpen = since !== null && Number.isFinite(Date.parse(since)) && now - Date.parse(since) < SHOPIFY_LINK_FAILURE_WINDOW_MS;
  const current = windowOpen ? failures : 0;
  return { blocked: current >= SHOPIFY_LINK_MAX_FAILURES, failures: current, windowStart: windowOpen ? since! : new Date(now).toISOString() };
}
