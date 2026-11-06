import { NextRequest, NextResponse } from "next/server";

import { delayMessage, findDelays, type DelayOrder } from "@/lib/commerce/delays";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

const LOOKBACK_DAYS = 30;

/** Bestellingen die vertraging oplopen, met een bericht dat de winkel naar de klant kan sturen. */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const db = getSupabaseAdmin();
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders, error } = await db
      .from("commerce_orders")
      .select("id, display_name, external_id, provider, order_created_at, cancelled_at, fulfillment_status")
      .eq("tenant_id", tenantId)
      .gte("order_created_at", since)
      .limit(500);
    if (error) throw new Error(error.message);
    const ids = (orders ?? []).map((order) => order.id as string);
    if (!ids.length) return NextResponse.json({ delays: [] });

    const [{ data: items, error: itemsError }, { data: fulfillments, error: fulfillmentsError }] = await Promise.all([
      db.from("commerce_order_items").select("order_id, latest_delivery_at").eq("tenant_id", tenantId).in("order_id", ids),
      db.from("commerce_fulfillments").select("order_id, shipment_date, created_at, latest_transport_event_at, transport_status_code, tracking_url").eq("tenant_id", tenantId).in("order_id", ids),
    ]);
    if (itemsError) throw new Error(itemsError.message);
    if (fulfillmentsError) throw new Error(fulfillmentsError.message);

    const promised = new Map<string, string>();
    for (const item of items ?? []) {
      if (!item.latest_delivery_at) continue;
      const current = promised.get(item.order_id as string);
      if (!current || item.latest_delivery_at < current) promised.set(item.order_id as string, item.latest_delivery_at as string);
    }
    const shipment = new Map<string, { shippedAt: string | null; lastTrackingAt: string | null; transportCode: string | null; trackingUrl: string | null }>();
    for (const row of fulfillments ?? []) {
      shipment.set(row.order_id as string, {
        shippedAt: (row.shipment_date ?? row.created_at) as string | null,
        lastTrackingAt: (row.latest_transport_event_at ?? null) as string | null,
        transportCode: (row.transport_status_code ?? null) as string | null,
        trackingUrl: (row.tracking_url ?? null) as string | null,
      });
    }

    const input: DelayOrder[] = (orders ?? []).map((order) => {
      const ship = shipment.get(order.id as string);
      const fulfilled = ["FULFILLED", "SHIPPED", "PARTIAL"].includes(String(order.fulfillment_status ?? "").toUpperCase());
      return {
        id: order.id as string,
        displayName: (order.display_name ?? order.external_id ?? null) as string | null,
        provider: order.provider as string,
        orderCreatedAt: order.order_created_at as string | null,
        cancelledAt: order.cancelled_at as string | null,
        promisedBy: promised.get(order.id as string) ?? null,
        shippedAt: ship?.shippedAt ?? (fulfilled ? (order.order_created_at as string | null) : null),
        lastTrackingAt: ship?.lastTrackingAt ?? null,
        transportCode: ship?.transportCode ?? null,
        trackingUrl: ship?.trackingUrl ?? null,
      };
    });
    const { data: config } = await db.from("tenant_agent_config").select("language_default").eq("tenant_id", tenantId).maybeSingle();
    const nl = config?.language_default !== "en";
    const delays = findDelays(input).slice(0, 20).map((delay) => ({
      orderId: delay.order.id,
      order: delay.order.displayName,
      provider: delay.order.provider,
      reason: delay.reason,
      days: delay.days,
      trackingUrl: delay.order.trackingUrl,
      message: delayMessage(delay, nl),
    }));
    return NextResponse.json({ delays });
  } catch (err) {
    if (err instanceof Error && err.message === "Not authenticated") return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    console.error("[commerce/delays]", err);
    return NextResponse.json({ error: "Vertragingen konden niet worden geladen." }, { status: 500 });
  }
}
