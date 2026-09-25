import assert from "node:assert/strict";
import { test } from "node:test";
import {
  linkAttemptState,
  parseCustomerPrivacyPayload,
  parseOrderWebhookGid,
  planShopRedaction,
} from "../lib/shopify/webhookPolicy.ts";

test("shop/redact deletes a created workspace but only Shopify data of a linked one", () => {
  assert.equal(planShopRedaction({ status: "uninstalled", tenant_id: "t1", tenant_origin: "created" }), "delete_workspace");
  assert.equal(planShopRedaction({ status: "uninstalled", tenant_id: "t1", tenant_origin: "linked" }), "delete_shopify_data");
});

test("shop/redact never touches a reinstalled shop or data that does not exist", () => {
  assert.equal(planShopRedaction({ status: "active", tenant_id: "t1", tenant_origin: "created" }), "skip_reinstalled");
  assert.equal(planShopRedaction({ status: "uninstalled", tenant_id: null, tenant_origin: null }), "nothing_stored");
  assert.equal(planShopRedaction(null), "nothing_stored");
});

test("a workspace without a recorded origin is treated as created for the shop", () => {
  assert.equal(planShopRedaction({ status: "uninstalled", tenant_id: "t1", tenant_origin: null }), "delete_workspace");
});

test("customer privacy payloads yield a normalised email and order gids", () => {
  assert.deepEqual(parseCustomerPrivacyPayload({ customer: { email: " Jan@Example.com " }, orders_requested: [123, "456"], orders_to_redact: [123] }), {
    customerEmail: "jan@example.com",
    orderGids: ["gid://shopify/Order/123", "gid://shopify/Order/456"],
  });
  assert.deepEqual(parseCustomerPrivacyPayload({ customer: { email: null }, orders_to_redact: ["x"] }), { customerEmail: null, orderGids: [] });
  assert.deepEqual(parseCustomerPrivacyPayload(null), { customerEmail: null, orderGids: [] });
});

test("order webhooks resolve to a GraphQL order id", () => {
  assert.equal(parseOrderWebhookGid({ admin_graphql_api_id: "gid://shopify/Order/42" }), "gid://shopify/Order/42");
  assert.equal(parseOrderWebhookGid({ id: 42 }), "gid://shopify/Order/42");
  assert.equal(parseOrderWebhookGid({ admin_graphql_api_id: "gid://shopify/Customer/1" }), null);
  assert.equal(parseOrderWebhookGid({}), null);
});

test("link-code guessing is blocked after 10 failures within an hour", () => {
  const now = Date.parse("2026-09-25T12:00:00Z");
  const recent = "2026-09-25T11:30:00Z";
  assert.equal(linkAttemptState(9, recent, now).blocked, false);
  assert.equal(linkAttemptState(10, recent, now).blocked, true);
  // After the window the counter starts over.
  assert.deepEqual(linkAttemptState(10, "2026-09-25T10:00:00Z", now), { blocked: false, failures: 0, windowStart: new Date(now).toISOString() });
  assert.equal(linkAttemptState(0, null, now).blocked, false);
});
