import type { NormalizedCommerceOrder, NormalizedFulfillment } from "./types.ts";

export type BolOrderItem = {
  orderItemId?: string;
  ean?: string;
  quantity?: number;
  quantityShipped?: number;
  quantityCancelled?: number;
  cancellationRequest?: boolean;
  unitPrice?: number;
  totalPrice?: number;
  latestChangedDateTime?: string;
  fulfilmentMethod?: string;
  fulfilmentStatus?: string;
  fulfilment?: {
    method?: string;
    distributionParty?: string;
    latestDeliveryDate?: string;
    exactDeliveryDate?: string;
  };
  offer?: { offerId?: string; reference?: string };
  product?: { ean?: string; title?: string };
};

export type BolOrder = {
  orderId?: string;
  orderPlacedDateTime?: string;
  shipmentDetails?: { email?: string };
  orderItems?: BolOrderItem[];
};

export type BolTransportEvent = {
  eventCode?: string;
  eventDescription?: string;
  eventDateTime?: string;
};

export type BolShipment = {
  shipmentId?: string;
  shipmentDateTime?: string;
  order?: { orderId?: string };
  transport?: {
    transporterCode?: string;
    trackAndTrace?: string;
    transportEvents?: BolTransportEvent[];
  };
};

export type BolReturnItem = {
  rmaId?: string;
  orderId?: string;
  ean?: string;
  title?: string;
  expectedQuantity?: number;
  handled?: boolean;
  returnReason?: { mainReason?: string; customerComments?: string };
  processingResults?: Array<{
    quantity?: number;
    processingResult?: string;
  }>;
};

export function normalizeBolReturnItem(item: BolReturnItem) {
  const processingResults = item.processingResults ?? [];
  return {
    expectedQuantity: Number(item.expectedQuantity ?? 0),
    handledQuantity: processingResults.reduce((sum, result) => sum + Number(result.quantity ?? 0), 0),
    handled: Boolean(item.handled),
    handlingResult: [...new Set(processingResults.map((result) => result.processingResult).filter(Boolean))]
      .join(", ") || null,
    reason: item.returnReason?.mainReason?.slice(0, 200) || null,
  };
}

function latestEvent(shipment: BolShipment) {
  return [...(shipment.transport?.transportEvents ?? [])].sort((a, b) =>
    Date.parse(b.eventDateTime ?? "") - Date.parse(a.eventDateTime ?? ""))[0];
}

export function normalizeBolOrder(order: BolOrder, shipments: BolShipment[] = []): NormalizedCommerceOrder {
  const items = order.orderItems ?? [];
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const shipped = items.reduce((sum, item) => sum + Number(item.quantityShipped ?? 0), 0);
  const cancelled = items.reduce((sum, item) => sum + Number(item.quantityCancelled ?? 0), 0);
  const fulfillmentStatus = totalQuantity > 0 && shipped >= totalQuantity ? "SHIPPED"
    : shipped > 0 ? "PARTIALLY_SHIPPED"
      : cancelled >= totalQuantity && totalQuantity > 0 ? "CANCELLED" : "OPEN";
  const updatedAt = items.map((item) => item.latestChangedDateTime).filter(Boolean).sort().at(-1) ?? null;
  return {
    externalId: String(order.orderId ?? ""),
    displayName: String(order.orderId ?? ""),
    customerEmail: order.shipmentDetails?.email ?? null,
    financialStatus: null,
    fulfillmentStatus,
    totalAmount: items.reduce((sum, item) =>
      sum + Number(item.totalPrice ?? (Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0))), 0),
    currencyCode: "EUR",
    cancelable: false,
    cancelledAt: fulfillmentStatus === "CANCELLED" ? updatedAt : null,
    createdAt: order.orderPlacedDateTime ?? new Date().toISOString(),
    updatedAt,
    items: items.map((item) => ({
      externalId: String(item.orderItemId ?? ""),
      productExternalId: item.product?.ean ?? item.ean ?? null,
      variantExternalId: null,
      sku: item.offer?.reference ?? null,
      title: item.product?.title ?? item.ean ?? "bol.com artikel",
      variantTitle: null,
      quantity: Number(item.quantity ?? 0),
      ean: item.product?.ean ?? item.ean ?? null,
      offerExternalId: item.offer?.offerId ?? null,
      unitPrice: item.unitPrice ?? null,
      fulfilmentMethod: item.fulfilment?.method ?? item.fulfilmentMethod ?? null,
      fulfilmentDistributionParty: item.fulfilment?.distributionParty ?? null,
      cancellationRequested: Boolean(item.cancellationRequest),
      latestDeliveryAt: item.fulfilment?.exactDeliveryDate ?? item.fulfilment?.latestDeliveryDate ?? null,
    })),
    fulfillments: shipments.map((shipment): NormalizedFulfillment => {
      const event = latestEvent(shipment);
      return {
        externalId: String(shipment.shipmentId ?? ""),
        status: event?.eventCode ?? null,
        trackingCompany: shipment.transport?.transporterCode ?? null,
        trackingNumber: shipment.transport?.trackAndTrace ?? null,
        trackingUrl: null,
        shipmentDate: shipment.shipmentDateTime ?? null,
        transportStatusCode: event?.eventCode ?? null,
        transportStatusDescription: event?.eventDescription ?? null,
        latestTransportEventAt: event?.eventDateTime ?? null,
      };
    }),
  };
}

export function bolTokenNeedsRefresh(expiresAt: string | null, now = Date.now()) {
  if (!expiresAt) return true;
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires - now <= 30_000;
}

export function decodeBolAccountId(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof payload.sub === "string" && payload.sub.trim() ? payload.sub.trim() : null;
  } catch {
    return null;
  }
}
