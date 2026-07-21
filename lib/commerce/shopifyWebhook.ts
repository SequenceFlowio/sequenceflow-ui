import crypto from "crypto";

export function shopifyWebhookEventId(input: {
  providerEventId: string | null;
  shopDomain: string;
  topic: string;
  rawBody: string;
}) {
  const deliveryIdentity = input.providerEventId ?? input.rawBody;
  return crypto.createHash("sha256")
    .update(`${input.shopDomain}:${input.topic}:${deliveryIdentity}`)
    .digest("hex");
}

export function parseShopifyWebhook(rawBody: string) {
  const payload = JSON.parse(rawBody) as {
    admin_graphql_api_id?: string;
    admin_graphql_api_order_id?: string;
    updated_at?: string;
    cancelled_at?: string;
    financial_status?: string;
    fulfillment_status?: string;
  };
  const externalOrderId = payload.admin_graphql_api_id?.includes("/Order/")
    ? payload.admin_graphql_api_id
    : payload.admin_graphql_api_order_id;
  return {
    externalOrderId: externalOrderId ?? null,
    occurredAt: payload.updated_at ?? null,
    eventData: {
      externalOrderId: externalOrderId ?? null,
      financialStatus: payload.financial_status ?? null,
      fulfillmentStatus: payload.fulfillment_status ?? null,
      cancelledAt: payload.cancelled_at ?? null,
    },
  };
}
