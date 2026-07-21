import { mapCommerceConnection } from "@/lib/commerce/connections";
import { shopifyScopeIssue, shopifyTokenExpiresAt, shopifyTokenNeedsRefresh } from "@/lib/commerce/shopifyAuth";
import {
  missingShopifyWebhookTopics,
  SHOPIFY_API_VERSION,
  SHOPIFY_CANCEL_ORDER_MUTATION,
  SHOPIFY_WEBHOOK_INCLUDE_FIELDS,
  type ShopifyWebhookTopic,
} from "@/lib/commerce/shopifyOperations";
import { submitShopifyCancellation } from "@/lib/commerce/shopifyAdapterCore";
import { shopifyGraphQlRequest, verifyShopifyHmac } from "@/lib/commerce/shopifyHttp";
import type {
  CancelOrderInput,
  CancelOrderResult,
  CommerceAdapter,
  CommerceConnection,
  NormalizedCommerceOrder,
} from "@/lib/commerce/types";
import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export { SHOPIFY_API_VERSION } from "@/lib/commerce/shopifyOperations";

export function normalizeShopDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new Error("Use the shop's .myshopify.com domain.");
  }
  return domain;
}

async function refreshAccessToken(connection: CommerceConnection) {
  const response = await fetch(`https://${connection.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: connection.clientId,
      client_secret: decryptSecret(connection.clientSecretEncrypted),
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; scope?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Shopify token exchange failed.");
  }
  const scopes = String(payload.scope ?? "").split(",").map((scope) => scope.trim()).filter(Boolean);
  const scopeIssue = shopifyScopeIssue(scopes);
  if (scopeIssue) throw new Error(scopeIssue);
  const expiresAt = shopifyTokenExpiresAt(payload.expires_in);
  const { error: tokenError } = await getSupabaseAdmin().from("commerce_connections").update({
    access_token_encrypted: encryptSecret(payload.access_token),
    token_expires_at: expiresAt,
    scopes,
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("tenant_id", connection.tenantId);
  if (tokenError) throw new Error(`Could not persist the refreshed Shopify token: ${tokenError.message}`);
  return { token: payload.access_token, scopes, expiresAt };
}

async function getToken(connection: CommerceConnection, force = false) {
  if (!force && connection.accessTokenEncrypted && !shopifyTokenNeedsRefresh(connection.tokenExpiresAt)) {
    return decryptSecret(connection.accessTokenEncrypted);
  }
  return (await refreshAccessToken(connection)).token;
}

async function graphql<T>(connection: CommerceConnection, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  return shopifyGraphQlRequest<T>({
    endpoint: `https://${connection.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    query,
    variables,
    getAccessToken: (forceRefresh) => getToken(connection, forceRefresh),
  });
}

type Money = { amount?: string; currencyCode?: string };
type ShopifyOrderNode = {
  id: string; name: string; email?: string | null; createdAt: string; updatedAt?: string | null; cancelledAt?: string | null;
  displayFinancialStatus?: string | null; displayFulfillmentStatus?: string | null;
  totalPriceSet?: { shopMoney?: Money };
  lineItems?: { nodes?: Array<{ id: string; name?: string; title?: string; quantity: number; sku?: string | null; variantTitle?: string | null; product?: { id?: string } | null; variant?: { id?: string } | null }> };
  fulfillments?: Array<{ id: string; status?: string | null; trackingInfo?: Array<{ company?: string | null; number?: string | null; url?: string | null }> }>;
};

function normalizeOrder(node: ShopifyOrderNode): NormalizedCommerceOrder {
  const fulfillment = String(node.displayFulfillmentStatus ?? "").toUpperCase();
  return {
    externalId: node.id,
    displayName: node.name,
    customerEmail: node.email ?? null,
    financialStatus: node.displayFinancialStatus ?? null,
    fulfillmentStatus: node.displayFulfillmentStatus ?? null,
    totalAmount: Number(node.totalPriceSet?.shopMoney?.amount ?? 0),
    currencyCode: node.totalPriceSet?.shopMoney?.currencyCode ?? "EUR",
    cancelable: !node.cancelledAt && ["UNFULFILLED", "ON_HOLD", "SCHEDULED", ""].includes(fulfillment),
    cancelledAt: node.cancelledAt ?? null,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt ?? null,
    items: (node.lineItems?.nodes ?? []).map((item) => ({
      externalId: item.id,
      productExternalId: item.product?.id ?? null,
      variantExternalId: item.variant?.id ?? null,
      sku: item.sku ?? null,
      title: item.title || item.name || "Item",
      variantTitle: item.variantTitle ?? null,
      quantity: item.quantity,
    })),
    fulfillments: (node.fulfillments ?? []).map((item) => {
      const tracking = item.trackingInfo?.[0];
      return { externalId: item.id, status: item.status ?? null, trackingCompany: tracking?.company ?? null, trackingNumber: tracking?.number ?? null, trackingUrl: tracking?.url ?? null };
    }),
  };
}

const ORDER_FIELDS = `
  id name email createdAt updatedAt cancelledAt displayFinancialStatus displayFulfillmentStatus
  totalPriceSet { shopMoney { amount currencyCode } }
  lineItems(first: 100) { nodes { id name title quantity sku variantTitle product { id } variant { id } } }
  fulfillments(first: 20) { id status trackingInfo { company number url } }
`;

export class ShopifyAdapter implements CommerceAdapter {
  async refreshToken(connection: CommerceConnection) {
    const refreshed = await refreshAccessToken(connection);
    return { scopes: refreshed.scopes, expiresAt: refreshed.expiresAt };
  }

  async testConnection(connection: CommerceConnection) {
    const data = await graphql<{
      shop: { name: string; currencyCode: string };
      currentAppInstallation: {
        accessScopes: Array<{ handle: string }>;
        app: { webhookApiVersion: string };
      };
      orders: { nodes: Array<{ id: string; email?: string | null }> };
    }>(
      connection,
      `query ConnectionTest {
        shop { name currencyCode }
        currentAppInstallation { accessScopes { handle } app { webhookApiVersion } }
        orders(first: 1, sortKey: UPDATED_AT, reverse: true) { nodes { id email } }
      }`,
    );
    const scopes = data.currentAppInstallation.accessScopes.map((scope) => scope.handle);
    const scopeIssue = shopifyScopeIssue(scopes);
    if (scopeIssue) throw new Error(scopeIssue);
    if (data.currentAppInstallation.app.webhookApiVersion !== SHOPIFY_API_VERSION) {
      throw new Error(`Set the Shopify app webhook API version to ${SHOPIFY_API_VERSION}.`);
    }
    return { shopName: data.shop.name, currencyCode: data.shop.currencyCode, scopes };
  }

  async findOrders(connection: CommerceConnection, input: { email?: string; orderNumber?: string }) {
    const orderNumber = String(input.orderNumber ?? "").replace(/^#/, "").replace(/[^a-z0-9-]/gi, "");
    const email = String(input.email ?? "").trim().toLowerCase().replace(/["\\]/g, "");
    if (!orderNumber && !email) return [];
    const search = orderNumber ? `name:${orderNumber}` : `email:"${email}"`;
    const data = await graphql<{ orders: { nodes: ShopifyOrderNode[] } }>(
      connection,
      `query FindOrders($query: String!) { orders(first: 20, sortKey: UPDATED_AT, reverse: true, query: $query) { nodes { ${ORDER_FIELDS} } } }`,
      { query: search },
    );
    return data.orders.nodes.map(normalizeOrder);
  }

  async syncRecentOrders(connection: CommerceConnection, since: string) {
    const sinceIso = new Date(since).toISOString();
    const orders: ShopifyOrderNode[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page += 1) {
      const data: {
        orders: {
          nodes: ShopifyOrderNode[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } = await graphql(
        connection,
        `query RecentOrders($query: String!, $after: String) {
          orders(first: 100, after: $after, sortKey: UPDATED_AT, reverse: true, query: $query) {
            nodes { ${ORDER_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        { query: `updated_at:>='${sinceIso}'`, after: cursor },
      );
      orders.push(...data.orders.nodes);
      if (!data.orders.pageInfo.hasNextPage || !data.orders.pageInfo.endCursor) break;
      cursor = data.orders.pageInfo.endCursor;
    }
    return orders.map(normalizeOrder);
  }

  async getOrder(connection: CommerceConnection, externalOrderId: string) {
    const data = await graphql<{ order: ShopifyOrderNode | null }>(
      connection,
      `query GetOrder($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
      { id: externalOrderId },
    );
    return data.order ? normalizeOrder(data.order) : null;
  }

  async cancelOrder(connection: CommerceConnection, input: CancelOrderInput): Promise<CancelOrderResult> {
    return submitShopifyCancellation({
      graphql: (query, variables) => graphql(connection, query, variables),
      mutation: SHOPIFY_CANCEL_ORDER_MUTATION,
      externalOrderId: input.externalOrderId,
      staffNote: input.staffNote,
    });
  }

  async registerWebhooks(connection: CommerceConnection, callbackUrl: string) {
    const subscriptions = await this.listWebhooks(connection, callbackUrl);
    for (const topic of missingShopifyWebhookTopics(subscriptions, callbackUrl)) {
      const data = await graphql<{ webhookSubscriptionCreate: { userErrors?: Array<{ message?: string }> } }>(
        connection,
        `mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) { userErrors { message } }
        }`,
        {
          topic,
          subscription: {
            uri: callbackUrl,
            format: "JSON",
            includeFields: SHOPIFY_WEBHOOK_INCLUDE_FIELDS[topic as ShopifyWebhookTopic],
          },
        },
      );
      const message = data.webhookSubscriptionCreate.userErrors?.[0]?.message;
      if (message) throw new Error(message);
    }
  }

  async unregisterWebhooks(connection: CommerceConnection, callbackUrl: string) {
    const subscriptions = await this.listWebhooks(connection, callbackUrl);
    for (const subscription of subscriptions) {
      const data = await graphql<{ webhookSubscriptionDelete: { userErrors?: Array<{ message?: string }> } }>(
        connection,
        `mutation DeleteWebhook($id: ID!) { webhookSubscriptionDelete(id: $id) { userErrors { message } } }`,
        { id: subscription.id },
      );
      const message = data.webhookSubscriptionDelete.userErrors?.[0]?.message;
      if (message) throw new Error(message);
    }
  }

  private async listWebhooks(connection: CommerceConnection, callbackUrl: string) {
    const subscriptions = await graphql<{
      webhookSubscriptions: { nodes: Array<{ id: string; topic: string; uri: string }> };
    }>(
      connection,
      `query SequenceFlowWebhooks($uri: String!) {
        webhookSubscriptions(first: 100, uri: $uri) { nodes { id topic uri } }
      }`,
      { uri: callbackUrl },
    );
    return subscriptions.webhookSubscriptions.nodes.filter((subscription) => subscription.uri === callbackUrl);
  }
}

export function verifyShopifyWebhook(rawBody: string, signature: string | null, encryptedSecret: string) {
  return verifyShopifyHmac(rawBody, signature, decryptSecret(encryptedSecret));
}

export async function reloadConnection(connectionId: string) {
  const { data, error } = await getSupabaseAdmin().from("commerce_connections").select("*").eq("id", connectionId).single();
  if (error || !data) throw new Error("Commerce connection not found.");
  return mapCommerceConnection(data);
}
