import { NextResponse } from "next/server";

import { AuthorizationError, authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  external_id: string;
  display_name: string;
  fulfillment_status: string | null;
  total_amount: number | string;
  currency_code: string;
  order_created_at: string;
  last_synced_at: string;
};

type ItemRow = {
  order_id: string;
  title: string;
  quantity: number;
  ean: string | null;
  offer_external_id: string | null;
  fulfilment_method: string | null;
  fulfilment_distribution_party: string | null;
  latest_delivery_at: string | null;
};

type OfferRow = {
  order_id: string;
  external_id: string;
  ean: string | null;
  fulfilment_method: string | null;
  stock_amount: number | null;
  corrected_stock: number | null;
  price: number | string | null;
  currency_code: string;
  for_sale: boolean | null;
  last_synced_at: string;
};

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const supabase = getSupabaseAdmin();
    const { data: connection, error: connectionError } = await supabase
      .from("commerce_connections")
      .select("id,status,display_name,external_account_id,events_status,last_synced_at,last_returns_synced_at,last_error")
      .eq("tenant_id", context.tenantId)
      .eq("provider", "bol")
      .maybeSingle();
    if (connectionError) throw new Error(connectionError.message);

    if (!connection) {
      return NextResponse.json({
        connection: null,
        summary: { orders: 0, openOrders: 0, products: 0, lowStock: 0, activeReturns: 0 },
        orders: [],
        products: [],
        shipments: [],
        returns: [],
      });
    }

    const { data: orderData, error: orderError } = await supabase
      .from("commerce_orders")
      .select("id,external_id,display_name,fulfillment_status,total_amount,currency_code,order_created_at,last_synced_at")
      .eq("tenant_id", context.tenantId)
      .eq("provider", "bol")
      .order("order_created_at", { ascending: false })
      .limit(100);
    if (orderError) throw new Error(orderError.message);

    const orders = (orderData ?? []) as OrderRow[];
    const orderIds = orders.map((order) => order.id);
    const empty = { data: [], error: null };
    const [itemsResult, offersResult, shipmentsResult, returnsResult] = orderIds.length
      ? await Promise.all([
        supabase.from("commerce_order_items")
          .select("order_id,title,quantity,ean,offer_external_id,fulfilment_method,fulfilment_distribution_party,latest_delivery_at")
          .eq("tenant_id", context.tenantId)
          .in("order_id", orderIds),
        supabase.from("commerce_offer_snapshots")
          .select("order_id,external_id,ean,fulfilment_method,stock_amount,corrected_stock,price,currency_code,for_sale,last_synced_at")
          .eq("tenant_id", context.tenantId)
          .in("order_id", orderIds)
          .order("last_synced_at", { ascending: false }),
        supabase.from("commerce_fulfillments")
          .select("order_id,external_id,status,tracking_company,tracking_number,shipment_date,transport_status_description,latest_transport_event_at")
          .eq("tenant_id", context.tenantId)
          .in("order_id", orderIds)
          .order("latest_transport_event_at", { ascending: false })
          .limit(100),
        supabase.from("commerce_returns")
          .select("id,order_id,external_id,fulfilment_method,registered_at,handled,last_synced_at,commerce_return_items(ean,title,expected_quantity,handled_quantity,handled,handling_result,reason)")
          .eq("tenant_id", context.tenantId)
          .eq("provider", "bol")
          .order("registered_at", { ascending: false })
          .limit(100),
      ])
      : [empty, empty, empty, empty];

    for (const result of [itemsResult, offersResult, shipmentsResult, returnsResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const items = (itemsResult.data ?? []) as ItemRow[];
    const offers = (offersResult.data ?? []) as OfferRow[];
    const orderById = new Map(orders.map((order) => [order.id, order]));
    const itemsByOrder = new Map<string, ItemRow[]>();
    for (const item of items) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);

    const latestOfferByKey = new Map<string, OfferRow>();
    for (const offer of offers) {
      const key = offer.external_id || offer.ean || `${offer.order_id}:unknown`;
      if (!latestOfferByKey.has(key)) latestOfferByKey.set(key, offer);
    }

    const itemByOffer = new Map<string, ItemRow>();
    for (const item of items) {
      if (item.offer_external_id && !itemByOffer.has(item.offer_external_id)) itemByOffer.set(item.offer_external_id, item);
    }

    const products = [...latestOfferByKey.values()].map((offer) => {
      const item = itemByOffer.get(offer.external_id)
        ?? items.find((candidate) => candidate.order_id === offer.order_id && candidate.ean === offer.ean);
      const stock = offer.corrected_stock ?? offer.stock_amount;
      return {
        offerId: offer.external_id,
        title: item?.title ?? "bol.com artikel",
        ean: offer.ean ?? item?.ean ?? null,
        fulfilmentMethod: offer.fulfilment_method ?? item?.fulfilment_method ?? null,
        distributionParty: item?.fulfilment_distribution_party ?? null,
        stock,
        stockKnown: stock !== null,
        price: safeNumber(offer.price),
        currency: offer.currency_code,
        forSale: offer.for_sale,
        lastSyncedAt: offer.last_synced_at,
      };
    }).sort((a, b) => a.title.localeCompare(b.title, "nl"));

    const responseOrders = orders.map((order) => {
      const orderItems = itemsByOrder.get(order.id) ?? [];
      const fulfilmentByKey = new Map<string, { method: string | null; distributionParty: string | null }>();
      for (const item of orderItems) {
        const method = item.fulfilment_method ?? null;
        const distributionParty = item.fulfilment_distribution_party ?? null;
        if (!method && !distributionParty) continue;
        fulfilmentByKey.set(`${method ?? ""}:${distributionParty ?? ""}`, { method, distributionParty });
      }
      return {
        id: order.id,
        orderNumber: order.display_name || order.external_id,
        createdAt: order.order_created_at,
        status: order.fulfillment_status,
        total: safeNumber(order.total_amount),
        currency: order.currency_code,
        itemCount: orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        fulfilment: [...fulfilmentByKey.values()],
        latestDeliveryAt: orderItems.map((item) => item.latest_delivery_at).filter(Boolean).sort().at(-1) ?? null,
        lastSyncedAt: order.last_synced_at,
      };
    });

    const shipments = (shipmentsResult.data ?? []).map((shipment) => ({
      orderNumber: orderById.get(String(shipment.order_id))?.display_name ?? null,
      orderStatus: orderById.get(String(shipment.order_id))?.fulfillment_status ?? null,
      shipmentId: shipment.external_id,
      status: shipment.transport_status_description || shipment.status || null,
      carrier: shipment.tracking_company,
      trackingNumber: shipment.tracking_number,
      shippedAt: shipment.shipment_date,
      latestEventAt: shipment.latest_transport_event_at,
    }));

    const returns = (returnsResult.data ?? []).map((returnRow) => ({
      returnId: returnRow.external_id,
      orderNumber: returnRow.order_id ? orderById.get(String(returnRow.order_id))?.display_name ?? null : null,
      fulfilmentMethod: returnRow.fulfilment_method,
      registeredAt: returnRow.registered_at,
      handled: Boolean(returnRow.handled),
      lastSyncedAt: returnRow.last_synced_at,
      items: Array.isArray(returnRow.commerce_return_items) ? returnRow.commerce_return_items : [],
    }));

    return NextResponse.json({
      connection: {
        status: connection.status,
        displayName: connection.display_name,
        externalAccountId: connection.external_account_id,
        eventsStatus: connection.events_status,
        lastOrderSync: connection.last_synced_at,
        lastReturnSync: connection.last_returns_synced_at,
        lastError: connection.last_error,
      },
      summary: {
        orders: responseOrders.length,
        openOrders: responseOrders.filter((order) => !["SHIPPED", "CANCELLED"].includes(order.status ?? "")).length,
        products: products.length,
        lowStock: products.filter((product) => product.stockKnown && Number(product.stock) <= 5).length,
        activeReturns: returns.filter((item) => !item.handled).length,
      },
      orders: responseOrders,
      products,
      shipments,
      returns,
      dataQuality: {
        shipmentsWithoutTransportEvent: shipments.filter((shipment) =>
          Boolean(shipment.trackingNumber) && !shipment.status && !shipment.latestEventAt).length,
        productsWithoutStock: products.filter((product) => !product.stockKnown).length,
        returnsWithoutRegistrationDate: returns.filter((item) => !item.registeredAt).length,
      },
    });
  } catch (error) {
    if (
      error instanceof AuthorizationError
      || (error instanceof Error && ["Not authenticated", "Tenant not found for user"].includes(error.message))
    ) {
      const auth = authorizationErrorResponse(error);
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error("[commerce/overview]", error);
    return NextResponse.json({ error: "Commerce-overzicht kon niet worden geladen.", retryable: true }, { status: 500 });
  }
}
