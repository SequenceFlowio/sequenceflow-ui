export const SHOPIFY_API_VERSION = "2026-07";

export const SHOPIFY_CANCEL_ORDER_MUTATION = `mutation CancelOrder($orderId: ID!, $staffNote: String) {
  orderCancel(orderId: $orderId, notifyCustomer: false, refundMethod: { originalPaymentMethodsRefund: true }, restock: true, reason: CUSTOMER, staffNote: $staffNote) {
    job { id done }
    orderCancelUserErrors { message }
    userErrors { message }
  }
}`;

export const SHOPIFY_WEBHOOK_TOPICS = [
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "ORDERS_CANCELLED",
  "ORDERS_FULFILLED",
  "ORDERS_PARTIALLY_FULFILLED",
] as const;

export type ShopifyWebhookTopic = typeof SHOPIFY_WEBHOOK_TOPICS[number];

export const SHOPIFY_WEBHOOK_INCLUDE_FIELDS: Record<ShopifyWebhookTopic, readonly string[]> = {
  ORDERS_CREATE: ["admin_graphql_api_id", "updated_at", "cancelled_at", "financial_status", "fulfillment_status"],
  ORDERS_UPDATED: ["admin_graphql_api_id", "updated_at", "cancelled_at", "financial_status", "fulfillment_status"],
  ORDERS_CANCELLED: ["admin_graphql_api_id", "updated_at", "cancelled_at", "financial_status", "fulfillment_status"],
  ORDERS_FULFILLED: ["admin_graphql_api_id", "updated_at", "cancelled_at", "financial_status", "fulfillment_status"],
  ORDERS_PARTIALLY_FULFILLED: ["admin_graphql_api_id", "updated_at", "cancelled_at", "financial_status", "fulfillment_status"],
};

export function missingShopifyWebhookTopics(
  existing: Array<{ topic: string; uri: string }>,
  callbackUrl: string,
) {
  const registered = new Set(
    existing
      .filter((subscription) => subscription.uri === callbackUrl)
      .map((subscription) => subscription.topic),
  );
  return SHOPIFY_WEBHOOK_TOPICS.filter((topic) => !registered.has(topic));
}
