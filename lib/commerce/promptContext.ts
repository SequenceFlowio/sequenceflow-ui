import type { CommerceResolution } from "@/lib/commerce/resolution";

/**
 * Pure: zet een gevonden bestelling om in de COMMERCE CONTEXT van de prompt.
 * Staat los van resolution.ts (database), zodat de live testset
 * (scripts/eval-support.ts) precies dezelfde tekst kan bouwen.
 */
export function buildCommercePromptContext(resolution: CommerceResolution | null) {
  if (!resolution) return "";
  if (!resolution?.order) {
    return resolution?.candidates.length
      ? "COMMERCE CONTEXT\nMultiple orders match this customer. Ask for the order number. Do not claim an action was taken."
      : "COMMERCE CONTEXT\nNo verified commerce order is linked. Never claim shipping, refund, or cancellation facts.";
  }
  const order = resolution.order;
  const items = order.items.map((item) => `${item.quantity}x ${item.title}${item.sku ? ` (SKU ${item.sku})` : ""}`).join(", ");
  const tracking = order.fulfillments.map((item) => [item.status, item.trackingCompany, item.trackingNumber].filter(Boolean).join(" / ")).filter(Boolean).join(", ");
  const returns = order.returns.flatMap((item) => item.items.map((returnItem) =>
    `${returnItem.title ?? returnItem.ean ?? "item"}: ${returnItem.handled ? "processed" : "registered"}${returnItem.handlingResult ? ` (${returnItem.handlingResult})` : ""}`)).join(", ");
  const offers = order.offers.map((item) => {
    const orderItem = order.items.find((line) => line.offerExternalId === item.externalId || (item.ean && line.ean === item.ean));
    const label = orderItem ? `${orderItem.title}${orderItem.variantTitle ? ` (${orderItem.variantTitle})` : ""}` : item.ean ?? item.externalId;
    const stock = item.correctedStock ?? item.stockAmount;
    return `${label}: stock ${stock ?? "unknown"}, for sale ${item.forSale === null ? "unknown" : item.forSale ? "yes" : "no"}`;
  }).join(", ");
  return `COMMERCE CONTEXT — LIVE SOURCE OF TRUTH
- Order: ${order.displayName}
- Financial status: ${order.financialStatus ?? "unknown"}
- Fulfillment status: ${order.fulfillmentStatus ?? "unknown"}
- Amount: ${order.totalAmount} ${order.currencyCode}
- Cancelable pre-check: ${order.cancelable ? "yes" : "no"}
- Items: ${items || "not loaded"}
- Fulfillment/tracking: ${tracking || "none"}
- Returns: ${returns || "none registered"}
- Relevant offer/stock: ${offers || "not loaded"}
- Last synced: ${order.lastSyncedAt}
- actionsAllowed: ${resolution.provider === "bol" ? "false (read-only bol.com v1)" : resolution.actionMode === "approval_required" ? "human approval required" : "false"}

Live commerce facts override profile, policy, historical examples, and inference. ${resolution.provider !== "bol" && resolution.actionMode === "approval_required" && order.cancelable ? `If the customer explicitly requests cancellation, return requires_human=true and actions=[{"type":"cancel_order","payload":{"orderId":"${order.id}"}}].` : "Do not propose a commerce action."} Never say a return, shipment, refund, or cancellation was performed unless live provider status proves it.`;
}
