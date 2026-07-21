import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { submitShopifyCancellation } from "../lib/commerce/shopifyAdapterCore.ts";
import { isUnknownShopifyMutationOutcome, shopifyGraphQlRequest, verifyShopifyHmac } from "../lib/commerce/shopifyHttp.ts";
import { shopifyScopeIssue, shopifyTokenExpiresAt } from "../lib/commerce/shopifyAuth.ts";
import {
  missingShopifyWebhookTopics,
  SHOPIFY_CANCEL_ORDER_MUTATION,
  SHOPIFY_WEBHOOK_INCLUDE_FIELDS,
  SHOPIFY_WEBHOOK_TOPICS,
} from "../lib/commerce/shopifyOperations.ts";
import { parseShopifyWebhook, shopifyWebhookEventId } from "../lib/commerce/shopifyWebhook.ts";

test("Shopify GraphQL refreshes an expired token once", async () => {
  const tokens: boolean[] = [];
  let calls = 0;
  const data = await shopifyGraphQlRequest<{ shop: { name: string } }>({
    endpoint: "https://example.myshopify.com/admin/api/2026-07/graphql.json",
    query: "query { shop { name } }",
    getAccessToken: async (force) => { tokens.push(force); return force ? "fresh" : "expired"; },
    fetchImpl: async (_url, init) => {
      calls += 1;
      const token = new Headers(init?.headers).get("x-shopify-access-token");
      return token === "expired"
        ? new Response("{}", { status: 401 })
        : Response.json({ data: { shop: { name: "Pilot" } } });
    },
  });
  assert.equal(data.shop.name, "Pilot");
  assert.equal(calls, 2);
  assert.deepEqual(tokens, [false, true]);
});

test("Shopify GraphQL retries HTTP and calculated-cost throttling", async () => {
  const waits: number[] = [];
  const responses = [
    new Response("{}", { status: 429, headers: { "retry-after": "1" } }),
    Response.json({ errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }], extensions: { cost: { requestedQueryCost: 60, throttleStatus: { currentlyAvailable: 10, restoreRate: 50 } } } }),
    Response.json({ data: { ok: true } }),
  ];
  const data = await shopifyGraphQlRequest<{ ok: boolean }>({
    endpoint: "https://example.myshopify.com/admin/api/2026-07/graphql.json",
    query: "query { shop { id } }",
    getAccessToken: async () => "token",
    fetchImpl: async () => responses.shift()!,
    sleep: async (milliseconds) => { waits.push(milliseconds); },
  });
  assert.equal(data.ok, true);
  assert.deepEqual(waits, [1000, 1000]);
});

test("Shopify GraphQL surfaces provider errors without leaking response bodies", async () => {
  await assert.rejects(
    shopifyGraphQlRequest({
      endpoint: "https://example.myshopify.com/admin/api/2026-07/graphql.json",
      query: "mutation { orderCancel { job { id } } }",
      getAccessToken: async () => "token",
      fetchImpl: async () => Response.json({ errors: [{ message: "Missing write_orders scope" }] }),
      maxRetries: 0,
    }),
    /Missing write_orders scope/,
  );
});

test("an unconfirmed mutation response is quarantined from automatic retry", async () => {
  await assert.rejects(
    shopifyGraphQlRequest({
      endpoint: "https://shop.test/graphql.json",
      query: "mutation Cancel { orderCancel(orderId: \"gid://shopify/Order/1\") { job { id } } }",
      getAccessToken: async () => "token",
      fetchImpl: async () => { throw new TypeError("socket closed"); },
    }),
    (error) => isUnknownShopifyMutationOutcome(error),
  );
});

test("a failed read remains normally retryable", async () => {
  await assert.rejects(
    shopifyGraphQlRequest({
      endpoint: "https://shop.test/graphql.json",
      query: "query Order { order(id: \"gid://shopify/Order/1\") { id } }",
      getAccessToken: async () => "token",
      fetchImpl: async () => { throw new TypeError("socket closed"); },
    }),
    (error) => !isUnknownShopifyMutationOutcome(error),
  );
});

test("Shopify webhook HMAC rejects missing and tampered signatures", () => {
  const body = JSON.stringify({ id: 42, topic: "orders/updated" });
  const secret = "webhook-secret";
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyShopifyHmac(body, signature, secret), true);
  assert.equal(verifyShopifyHmac(`${body} `, signature, secret), false);
  assert.equal(verifyShopifyHmac(body, null, secret), false);
});

test("Shopify webhook persistence is deterministic and strictly normalized", () => {
  const rawBody = JSON.stringify({
    admin_graphql_api_order_id: "gid://shopify/Order/42",
    updated_at: "2026-07-20T12:00:00Z",
    financial_status: "paid",
    fulfillment_status: null,
    cancelled_at: null,
    email: "customer@example.nl",
    shipping_address: { address1: "Private street 1" },
  });
  const first = shopifyWebhookEventId({ providerEventId: null, shopDomain: "pilot.myshopify.com", topic: "fulfillments/create", rawBody });
  const second = shopifyWebhookEventId({ providerEventId: null, shopDomain: "pilot.myshopify.com", topic: "fulfillments/create", rawBody });
  assert.equal(first, second);
  assert.deepEqual(parseShopifyWebhook(rawBody), {
    externalOrderId: "gid://shopify/Order/42",
    occurredAt: "2026-07-20T12:00:00Z",
    eventData: {
      externalOrderId: "gid://shopify/Order/42",
      financialStatus: "paid",
      fulfillmentStatus: null,
      cancelledAt: null,
    },
  });
  assert.equal(JSON.stringify(parseShopifyWebhook(rawBody)).includes("customer@example.nl"), false);
  assert.equal(JSON.stringify(parseShopifyWebhook(rawBody)).includes("Private street"), false);
  assert.notEqual(
    shopifyWebhookEventId({ providerEventId: "merchant-action-1", shopDomain: "pilot.myshopify.com", topic: "orders/updated", rawBody }),
    shopifyWebhookEventId({ providerEventId: "merchant-action-1", shopDomain: "pilot.myshopify.com", topic: "fulfillments/create", rawBody }),
  );
});

test("Shopify webhook registration is idempotent and excludes customer payload fields", () => {
  const callbackUrl = "https://emailreply.sequenceflow.io/api/integrations/shopify/webhook";
  assert.deepEqual(
    missingShopifyWebhookTopics([
      { topic: "ORDERS_CREATE", uri: callbackUrl },
      { topic: "ORDERS_UPDATED", uri: "https://elsewhere.example/webhook" },
    ], callbackUrl),
    SHOPIFY_WEBHOOK_TOPICS.filter((topic) => topic !== "ORDERS_CREATE"),
  );
  for (const fields of Object.values(SHOPIFY_WEBHOOK_INCLUDE_FIELDS)) {
    const normalized = fields.join(" ").toLowerCase();
    assert.doesNotMatch(normalized, /email|customer|address|phone|line_items/);
    assert.match(normalized, /updated_at/);
  }
});

test("Shopify token expiry follows the 24-hour client-credentials contract", () => {
  const now = Date.parse("2026-07-21T12:00:00.000Z");
  assert.equal(shopifyTokenExpiresAt(86_399, now), "2026-07-22T11:59:59.000Z");
  assert.equal(shopifyTokenExpiresAt("invalid", now), "2026-07-22T11:59:59.000Z");
  assert.equal(shopifyTokenExpiresAt(999_999, now), "2026-07-22T12:00:00.000Z");
});

test("Shopify cancellation core submits the pinned contract and preserves an async job id", async () => {
  const captured: { request?: { url: string; token: string | null; body: { query: string; variables: Record<string, unknown> } } } = {};
  const result = await submitShopifyCancellation({
    mutation: SHOPIFY_CANCEL_ORDER_MUTATION,
    externalOrderId: "gid://shopify/Order/42",
    staffNote: "SequenceFlow test",
    graphql: (query, variables) => shopifyGraphQlRequest({
      endpoint: "https://pilot.myshopify.com/admin/api/2026-07/graphql.json",
      query,
      variables,
      getAccessToken: async () => "access-token",
      fetchImpl: async (url, init) => {
        captured.request = {
          url: String(url),
          token: new Headers(init?.headers).get("x-shopify-access-token"),
          body: JSON.parse(String(init?.body)),
        };
        return Response.json({
          data: {
            orderCancel: {
              job: { id: "gid://shopify/Job/42", done: false },
              orderCancelUserErrors: [],
              userErrors: [],
            },
          },
        });
      },
    }),
  });
  assert.deepEqual(result, {
    status: "provider_pending",
    providerJobId: "gid://shopify/Job/42",
    response: { jobId: "gid://shopify/Job/42", done: false },
  });
  assert.ok(captured.request);
  assert.equal(captured.request.url, "https://pilot.myshopify.com/admin/api/2026-07/graphql.json");
  assert.equal(captured.request.token, "access-token");
  assert.deepEqual(captured.request.body.variables, {
    orderId: "gid://shopify/Order/42",
    staffNote: "SequenceFlow test",
  });
  assert.match(captured.request.body.query, /notifyCustomer:\s*false/);
  assert.match(captured.request.body.query, /originalPaymentMethodsRefund:\s*true/);
  assert.match(captured.request.body.query, /restock:\s*true/);
});

test("Shopify cancellation core rejects provider user errors and out-of-policy scopes", async () => {
  await assert.rejects(
    submitShopifyCancellation({
      mutation: SHOPIFY_CANCEL_ORDER_MUTATION,
      externalOrderId: "gid://shopify/Order/42",
      staffNote: "test",
      graphql: async <T>() => ({
        orderCancel: {
          job: null,
          orderCancelUserErrors: [{ message: "Order has a fulfillment" }],
          userErrors: [],
        },
      }) as T,
    }),
    /Order has a fulfillment/,
  );
  assert.match(shopifyScopeIssue(["read_orders", "write_orders", "read_customers"]) ?? "", /outside.*read_customers/i);
});
