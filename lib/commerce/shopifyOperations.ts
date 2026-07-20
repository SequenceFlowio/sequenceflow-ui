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
  "FULFILLMENTS_CREATE",
  "FULFILLMENTS_UPDATE",
] as const;
