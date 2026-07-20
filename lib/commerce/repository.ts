import { customerKey } from "@/lib/commerce/identity";
import type { CommerceConnection, CommerceOrderContext, NormalizedCommerceOrder } from "@/lib/commerce/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function upsertCommerceOrder(connection: CommerceConnection, order: NormalizedCommerceOrder) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: saved, error } = await supabase.from("commerce_orders").upsert({
    tenant_id: connection.tenantId,
    connection_id: connection.id,
    provider: connection.provider,
    external_id: order.externalId,
    display_name: order.displayName,
    customer_key: order.customerEmail ? customerKey(connection.tenantId, order.customerEmail) : null,
    financial_status: order.financialStatus,
    fulfillment_status: order.fulfillmentStatus,
    total_amount: order.totalAmount,
    currency_code: order.currencyCode,
    cancelable: order.cancelable,
    cancelled_at: order.cancelledAt,
    order_created_at: order.createdAt,
    provider_updated_at: order.updatedAt,
    last_synced_at: now,
    updated_at: now,
  }, { onConflict: "tenant_id,provider,external_id" }).select("id").single();
  if (error || !saved) throw new Error(`Could not save commerce order: ${error?.message ?? "missing id"}`);

  const { error: childrenError } = await supabase.rpc("replace_commerce_order_children", {
    p_tenant_id: connection.tenantId,
    p_order_id: saved.id,
    p_items: order.items.map((item) => ({
      external_id: item.externalId, product_external_id: item.productExternalId,
      variant_external_id: item.variantExternalId, sku: item.sku, title: item.title,
      variant_title: item.variantTitle, quantity: item.quantity,
    })),
    p_fulfillments: order.fulfillments.map((item) => ({
      external_id: item.externalId, status: item.status, tracking_company: item.trackingCompany,
      tracking_number: item.trackingNumber, tracking_url: item.trackingUrl,
    })),
  });
  if (childrenError) throw new Error(`Could not replace order details: ${childrenError.message}`);
  return String(saved.id);
}

export async function loadOrderContext(tenantId: string, orderId: string, match?: { method: CommerceOrderContext["matchMethod"]; confidence: number }) {
  const supabase = getSupabaseAdmin();
  const [orderResult, itemsResult, fulfillmentsResult] = await Promise.all([
    supabase.from("commerce_orders").select("*").eq("tenant_id", tenantId).eq("id", orderId).maybeSingle(),
    supabase.from("commerce_order_items").select("title, variant_title, sku, quantity").eq("tenant_id", tenantId).eq("order_id", orderId),
    supabase.from("commerce_fulfillments").select("external_id, status, tracking_company, tracking_number, tracking_url").eq("tenant_id", tenantId).eq("order_id", orderId),
  ]);
  if (orderResult.error) throw new Error(`Could not load commerce order: ${orderResult.error.message}`);
  if (itemsResult.error) throw new Error(`Could not load commerce order items: ${itemsResult.error.message}`);
  if (fulfillmentsResult.error) throw new Error(`Could not load commerce fulfillments: ${fulfillmentsResult.error.message}`);
  const order = orderResult.data;
  const items = itemsResult.data;
  const fulfillments = fulfillmentsResult.data;
  if (!order) return null;
  return {
    id: String(order.id), connectionId: String(order.connection_id), provider: String(order.provider) as CommerceOrderContext["provider"],
    externalId: String(order.external_id), displayName: String(order.display_name),
    financialStatus: order.financial_status ?? null, fulfillmentStatus: order.fulfillment_status ?? null,
    totalAmount: Number(order.total_amount), currencyCode: String(order.currency_code), cancelable: Boolean(order.cancelable),
    cancelledAt: order.cancelled_at ?? null, orderCreatedAt: String(order.order_created_at), lastSyncedAt: String(order.last_synced_at),
    matchMethod: match?.method ?? "manual", matchConfidence: match?.confidence ?? 1,
    items: (items ?? []).map((item) => ({ title: item.title, variantTitle: item.variant_title, sku: item.sku, quantity: item.quantity })),
    fulfillments: (fulfillments ?? []).map((item) => ({ id: item.external_id, status: item.status, trackingCompany: item.tracking_company, trackingNumber: item.tracking_number, trackingUrl: item.tracking_url })),
  } satisfies CommerceOrderContext;
}
