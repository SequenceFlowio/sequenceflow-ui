import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { encryptSecret } from "../lib/security/credentials.ts";
import { normalizeWooOrder, verifyWooCommerceWebhook, wooCustomerEmailMatches } from "../lib/commerce/woocommerce.ts";
import { calculateWooRefundAmounts, submitWooCommerceCancellation, WOO_ACTION_META_KEY, type WooRequest } from "../lib/commerce/woocommerceAdapterCore.ts";
import { normalizeWooCommerceUrl } from "../lib/commerce/woocommerceHttp.ts";

test("WooCommerce URLs require public HTTPS origins", () => {
  assert.equal(normalizeWooCommerceUrl("https://noctis.example/shop/"), "https://noctis.example/shop");
  assert.throws(() => normalizeWooCommerceUrl("http://noctis.example"), /public HTTPS/);
  assert.throws(() => normalizeWooCommerceUrl("https://localhost"), /publicly reachable/);
  assert.throws(() => normalizeWooCommerceUrl("https://user:pass@noctis.example"), /without credentials/);
});

test("WooCommerce orders normalize conservatively for cancellation", () => {
  const base = { id: 42, number: "N-1042", currency: "EUR", total: "99.95", date_created_gmt: "2026-07-20T10:00:00", date_modified_gmt: "2026-07-20T11:00:00", billing: { email: "buyer@example.com" }, line_items: [{ id: 7, name: "Night cream", quantity: 2, product_id: 3, variation_id: 4, sku: "NIGHT-1" }] };
  const processing = normalizeWooOrder({ ...base, status: "processing", date_paid_gmt: "2026-07-20T10:01:00", refunds: [] });
  assert.equal(processing.displayName, "#N-1042");
  assert.equal(processing.cancelable, true);
  assert.equal(processing.financialStatus, "PAID");
  assert.equal(processing.fulfillmentStatus, "UNFULFILLED");
  const completed = normalizeWooOrder({ ...base, status: "completed", refunds: [] });
  assert.equal(completed.cancelable, false);
  assert.equal(completed.fulfillmentStatus, "FULFILLED");
  const partiallyRefunded = normalizeWooOrder({ ...base, status: "processing", refunds: [{ id: 9, total: "-10.05" }] });
  assert.equal(partiallyRefunded.financialStatus, "PARTIALLY_REFUNDED");
  const refunded = normalizeWooOrder({ ...base, status: "refunded", refunds: [{ id: 9, total: "-99.95" }] });
  assert.equal(refunded.cancelable, false);
  assert.equal(refunded.cancelledAt, null);
});

test("WooCommerce email matching is exact and case-insensitive", () => {
  assert.equal(wooCustomerEmailMatches({ billing: { email: " Buyer@Example.com " } }, "buyer@example.com"), true);
  assert.equal(wooCustomerEmailMatches({ billing: { email: "other@example.com" } }, "buyer@example.com"), false);
  assert.equal(wooCustomerEmailMatches({ billing: {} }, "buyer@example.com"), false);
});

test("WooCommerce refund arithmetic uses exact decimal amounts", () => {
  assert.deepEqual(calculateWooRefundAmounts("99.95", [{ amount: "10.05" }]), {
    orderTotal: "99.95",
    totalRefunded: "10.05",
    remaining: "89.90",
    remainingUnits: 8990n,
    scale: 2,
  });
  assert.equal(calculateWooRefundAmounts("12.345", [{ amount: "2.100" }]).remaining, "10.245");
});

test("WooCommerce cancellation refunds, restocks, and cancels exactly once", async () => {
  const calls: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  const request: WooRequest = async <T>(path, init = {}) => {
    const method = init.method || "GET";
    calls.push({ path, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (path.endsWith("/refunds") && method === "GET") return [] as T;
    if (path.endsWith("/refunds") && method === "POST") return { id: 81, amount: "99.95" } as T;
    if (method === "PUT") return { id: 42, status: "cancelled", total: "99.95" } as T;
    return { id: 42, status: "processing", total: "99.95", line_items: [{ id: 7, quantity: 2, total: "82.60", taxes: [{ id: 1, total: "17.35" }] }] } as T;
  };

  const result = await submitWooCommerceCancellation({ request, externalOrderId: "42", staffNote: "SequenceFlow conversation 1", idempotencyKey: "action-1" });
  assert.equal(result.response.refundCreated, true);
  assert.deepEqual(calls.map(({ path, method }) => ({ path, method })), [
    { path: "orders/42", method: "GET" },
    { path: "orders/42/refunds", method: "GET" },
    { path: "orders/42/refunds", method: "POST" },
    { path: "orders/42", method: "PUT" },
  ]);
  assert.deepEqual(calls[2].body, {
    amount: "99.95",
    reason: "SequenceFlow conversation 1",
    api_refund: true,
    api_restock: true,
    line_items: [{ id: 7, quantity: 2, refund_total: "82.60", refund_tax: [{ id: 1, refund_total: "17.35" }] }],
    meta_data: [{ key: WOO_ACTION_META_KEY, value: "action-1" }],
  });
});

test("WooCommerce cancellation retry reuses the fingerprinted refund", async () => {
  const calls: Array<{ path: string; method: string }> = [];
  const request: WooRequest = async <T>(path, init = {}) => {
    const method = init.method || "GET";
    calls.push({ path, method });
    if (path.endsWith("/refunds")) return [{ id: 81, amount: "99.95", meta_data: [{ key: WOO_ACTION_META_KEY, value: "action-1" }] }] as T;
    if (method === "PUT") return { id: 42, status: "cancelled", total: "99.95" } as T;
    return { id: 42, status: "processing", total: "99.95" } as T;
  };

  const result = await submitWooCommerceCancellation({ request, externalOrderId: "42", staffNote: "retry", idempotencyKey: "action-1" });
  assert.equal(result.response.refundCreated, false);
  assert.equal(result.response.refundId, 81);
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);
  assert.equal(calls.filter((call) => call.method === "PUT").length, 1);
});

test("WooCommerce cancellation retry closes a fully refunded order", async () => {
  const calls: Array<{ path: string; method: string }> = [];
  const request: WooRequest = async <T>(path, init = {}) => {
    const method = init.method || "GET";
    calls.push({ path, method });
    if (path.endsWith("/refunds")) return [{ id: 81, amount: "99.95", meta_data: [{ key: WOO_ACTION_META_KEY, value: "action-1" }] }] as T;
    if (method === "PUT") return { id: 42, status: "cancelled", total: "99.95" } as T;
    return { id: 42, status: "refunded", total: "99.95" } as T;
  };

  await submitWooCommerceCancellation({ request, externalOrderId: "42", staffNote: "retry", idempotencyKey: "action-1" });
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);
  assert.equal(calls.filter((call) => call.method === "PUT").length, 1);
});

test("WooCommerce cancellation blocks a pre-existing unrelated refund", async () => {
  let mutations = 0;
  const request: WooRequest = async <T>(path, init = {}) => {
    if (path.endsWith("/refunds") && !init.method) return [{ id: 70, amount: "25.00" }] as T;
    if (init.method && init.method !== "GET") mutations += 1;
    return { id: 42, status: "processing", total: "100.00" } as T;
  };
  await assert.rejects(
    submitWooCommerceCancellation({ request, externalOrderId: "42", staffNote: "partial", idempotencyKey: "action-2" }),
    /already has a refund.*manual handling/i,
  );
  assert.equal(mutations, 0);
});

test("WooCommerce cancellation blocks an incomplete fingerprinted refund", async () => {
  let mutations = 0;
  const request: WooRequest = async <T>(path, init = {}) => {
    if (init.method && init.method !== "GET") mutations += 1;
    if (path.endsWith("/refunds")) return [{ id: 81, amount: "50.00", meta_data: [{ key: WOO_ACTION_META_KEY, value: "action-1" }] }] as T;
    return { id: 42, status: "processing", total: "100.00" } as T;
  };
  await assert.rejects(
    submitWooCommerceCancellation({ request, externalOrderId: "42", staffNote: "retry", idempotencyKey: "action-1" }),
    /already exists.*not fully refunded/i,
  );
  assert.equal(mutations, 0);
});

test("WooCommerce webhook verification uses its encrypted per-connection secret", () => {
  const previous = process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY;
  process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY = "woo-test-key";
  try {
    const body = JSON.stringify({ id: 42 }); const secret = "webhook-secret";
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(verifyWooCommerceWebhook(body, signature, encryptSecret(secret)), true);
    assert.equal(verifyWooCommerceWebhook(`${body}x`, signature, encryptSecret(secret)), false);
  } finally { if (previous === undefined) delete process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY; else process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY = previous; }
});
