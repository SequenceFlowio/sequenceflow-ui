import { createHmac, timingSafeEqual } from "node:crypto";

import type { CancelOrderInput, CancelOrderResult, CommerceAdapter, CommerceConnection, NormalizedCommerceOrder } from "./types.ts";
import { decryptSecret } from "../security/credentials.ts";
import { wooRequest } from "./woocommerceHttp.ts";
import { submitWooCommerceCancellation, type WooMeta } from "./woocommerceAdapterCore.ts";

type WooOrder = {
  id: number; number: string; status: string; currency: string; total: string;
  date_created_gmt?: string; date_modified_gmt?: string; date_paid_gmt?: string | null;
  billing?: { email?: string | null };
  line_items?: Array<{ id: number; product_id?: number; variation_id?: number; sku?: string | null; name?: string; quantity: number; meta_data?: WooMeta[] }>;
  refunds?: Array<{ id: number; total?: string }>;
  meta_data?: WooMeta[];
};
const WEBHOOK_TOPICS = ["order.created", "order.updated", "order.deleted"];
export { WOO_ACTION_META_KEY } from "./woocommerceAdapterCore.ts";
export const wooGmtTimestamp = (value?: string | null) => value ? `${value.replace(/Z$/, "")}Z` : null;
export const wooCustomerEmailMatches = (order: Pick<WooOrder, "billing">, email: string) =>
  String(order.billing?.email ?? "").trim().toLowerCase() === email.trim().toLowerCase();

export function normalizeWooOrder(order: WooOrder): NormalizedCommerceOrder {
  const cancelled = order.status === "cancelled";
  const closed = cancelled || order.status === "refunded";
  const refunded = (order.refunds ?? []).reduce((sum, refund) => sum + Math.abs(Number(refund.total ?? 0)), 0);
  const total = Number(order.total || 0);
  const financialStatus = order.status === "refunded" || (total > 0 && refunded >= total)
    ? "REFUNDED" : refunded > 0 ? "PARTIALLY_REFUNDED" : order.date_paid_gmt ? "PAID" : "PENDING";
  const fulfillmentStatus = order.status === "completed" ? "FULFILLED" : closed ? "CANCELLED" : "UNFULFILLED";
  return {
    externalId: String(order.id), displayName: `#${order.number}`, customerEmail: order.billing?.email ?? null,
    financialStatus, fulfillmentStatus, totalAmount: total, currencyCode: order.currency || "EUR",
    cancelable: !closed && ["pending", "processing", "on-hold"].includes(order.status),
    cancelledAt: cancelled ? wooGmtTimestamp(order.date_modified_gmt) : null,
    createdAt: wooGmtTimestamp(order.date_created_gmt) ?? new Date(0).toISOString(), updatedAt: wooGmtTimestamp(order.date_modified_gmt),
    items: (order.line_items ?? []).map((item) => ({
      externalId: String(item.id), productExternalId: item.product_id ? String(item.product_id) : null,
      variantExternalId: item.variation_id ? String(item.variation_id) : null, sku: item.sku ?? null,
      title: item.name || "Item", variantTitle: null, quantity: item.quantity,
    })), fulfillments: [],
  };
}

export class WooCommerceAdapter implements CommerceAdapter {
  async refreshToken() { return { scopes: ["read_orders", "write_orders"], expiresAt: null }; }
  async testConnection(connection: CommerceConnection) {
    const [currency, status] = await Promise.all([
      wooRequest<{ code?: string }>(connection, "data/currencies/current"),
      wooRequest<{ environment?: { site_url?: string }; settings?: { currency?: string } }>(connection, "system_status"),
    ]);
    return { shopName: new URL(status.environment?.site_url || connection.shopDomain).hostname, currencyCode: currency.code || status.settings?.currency || "EUR", scopes: ["read_orders", "write_orders"] };
  }
  async findOrders(connection: CommerceConnection, input: { email?: string; orderNumber?: string }) {
    const search = String(input.orderNumber ?? input.email ?? "").replace(/^#/, "").trim();
    if (!search) return [];
    const params = new URLSearchParams({ search, per_page: "20", orderby: "modified", order: "desc" });
    const orders = await wooRequest<WooOrder[]>(connection, `orders?${params}`);
    const exact = input.orderNumber
      ? orders.filter((order) => String(order.number) === search || String(order.id) === search)
      : orders.filter((order) => input.email && wooCustomerEmailMatches(order, input.email));
    return exact.map(normalizeWooOrder);
  }
  async syncRecentOrders(connection: CommerceConnection, since: string) {
    const params = new URLSearchParams({ modified_after: since, dates_are_gmt: "true", per_page: "100", orderby: "modified", order: "desc" });
    return (await wooRequest<WooOrder[]>(connection, `orders?${params}`)).map(normalizeWooOrder);
  }
  async getOrder(connection: CommerceConnection, externalOrderId: string) {
    if (!/^\d+$/.test(externalOrderId)) return null;
    try { return normalizeWooOrder(await wooRequest<WooOrder>(connection, `orders/${externalOrderId}`)); }
    catch (error) { if (error instanceof Error && /not found|invalid id/i.test(error.message)) return null; throw error; }
  }
  async cancelOrder(connection: CommerceConnection, input: CancelOrderInput): Promise<CancelOrderResult> {
    return submitWooCommerceCancellation({
      request: (path, init) => wooRequest(connection, path, init),
      externalOrderId: input.externalOrderId,
      staffNote: input.staffNote,
      idempotencyKey: input.idempotencyKey || input.staffNote,
    });
  }
  async registerWebhooks(connection: CommerceConnection, callbackUrl: string) {
    if (!connection.accessTokenEncrypted) throw new Error("WooCommerce webhook secret is missing.");
    const existing = await wooRequest<Array<{ id: number; topic: string; delivery_url: string }>>(connection, "webhooks?per_page=100&status=all");
    for (const topic of WEBHOOK_TOPICS) if (!existing.some((hook) => hook.topic === topic && hook.delivery_url === callbackUrl)) {
      await wooRequest(connection, "webhooks", { method: "POST", body: JSON.stringify({ name: `SequenceFlow ${topic}`, topic, delivery_url: callbackUrl, status: "active", secret: decryptSecret(connection.accessTokenEncrypted) }) });
    }
  }
  async unregisterWebhooks(connection: CommerceConnection, callbackUrl: string) {
    const existing = await wooRequest<Array<{ id: number; delivery_url: string }>>(connection, "webhooks?per_page=100&status=all");
    for (const hook of existing.filter((item) => item.delivery_url === callbackUrl)) await wooRequest(connection, `webhooks/${hook.id}?force=true`, { method: "DELETE" });
  }
}

export function verifyWooCommerceWebhook(rawBody: string, signature: string | null, encryptedSecret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", decryptSecret(encryptedSecret)).update(rawBody).digest("base64");
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
