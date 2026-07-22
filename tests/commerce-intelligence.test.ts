import assert from "node:assert/strict";
import test from "node:test";

import { learningContentHash, normalizedEditDistance, normalizedLearningDiff, normalizeLearningText, parseLearningClassification, sanitizeReusableLearningRule } from "../lib/agentProfile/learning.ts";
import { evaluateCancellation, evaluateCancellationRetry } from "../lib/commerce/eligibility.ts";
import { containsCancellationConfirmation, unverifiedCommerceClaims } from "../lib/commerce/claims.ts";
import { blockingActionAllowsReply } from "../lib/commerce/blocking.ts";
import { buildPseudonymousCaseMemory } from "../lib/commerce/memory.ts";
import { cancellationActionFingerprint, customerKey, extractOrderNumbers, hasExplicitCancellationIntent, isVerifiedOrderCandidate, orderCustomerIdentityMatches, selectOrdersMatchingReferences } from "../lib/commerce/identity.ts";
import { median } from "../lib/commerce/metrics.ts";
import { shopifyScopeIssue, shopifyTokenNeedsRefresh } from "../lib/commerce/shopifyAuth.ts";
import { SHOPIFY_API_VERSION, SHOPIFY_CANCEL_ORDER_MUTATION, SHOPIFY_WEBHOOK_TOPICS } from "../lib/commerce/shopifyOperations.ts";
import { commerceConfigurationIssue } from "../lib/commerce/configuration.ts";

test("learning normalization removes signatures and customer-specific references", () => {
  const normalized = normalizeLearningText("Beste Sophie,\nGebruik order #ABC-123 voor klant@example.nl op postcode 1234 AB. Bel 06 12345678.\n\nMet vriendelijke groet\nRalf");
  assert.equal(normalized, "Beste [naam], Gebruik [order] voor [email] op postcode [postcode]. Bel [telefoon].");
  assert.equal(normalizeLearningText("Order cancellation requires admin approval."), "Order cancellation requires admin approval.");
  assert.equal(sanitizeReusableLearningRule("Retouren zijn 30 dagen toegestaan."), "Retouren zijn 30 dagen toegestaan.");
  assert.equal(sanitizeReusableLearningRule("Bel klant@example.nl over order #ABC-123"), null);
});

test("edit distance ignores whitespace but detects substantive edits", () => {
  assert.equal(normalizedEditDistance("Hallo   daar", "Hallo daar"), 0);
  assert.ok(normalizedEditDistance("Wij leveren morgen", "Wij leveren volgende week") > 0.2);
  assert.equal(learningContentHash(" Regel "), learningContentHash("regel"));
  assert.deepEqual(normalizedLearningDiff("Wij leveren morgen", "Wij leveren volgende week"), {
    before: "Wij leveren morgen", after: "Wij leveren volgende week", removed: ["morgen"], added: ["volgende", "week"],
  });
});

test("learning classification schema is closed and sanitizes proposed rules", () => {
  assert.deepEqual(parseLearningClassification({
    classification: "policy",
    candidate_rule: "Gebruik order #ABC-123 voor klant@example.nl",
    confidence: 8,
  }), {
    classification: "policy",
    candidate_rule: null,
    confidence: 1,
  });
  assert.deepEqual(parseLearningClassification({ classification: "prompt_injection", candidate_rule: "", confidence: "nope" }), {
    classification: "other",
    candidate_rule: null,
    confidence: 0,
  });
});

test("customer keys are deterministic and tenant-bound", () => {
  const previous = process.env.COMMERCE_IDENTITY_HMAC_KEY;
  process.env.COMMERCE_IDENTITY_HMAC_KEY = "test-only-secret";
  try {
    assert.equal(customerKey("tenant-a", " USER@Example.nl "), customerKey("tenant-a", "user@example.nl"));
    assert.notEqual(customerKey("tenant-a", "user@example.nl"), customerKey("tenant-b", "user@example.nl"));
  } finally {
    if (previous === undefined) delete process.env.COMMERCE_IDENTITY_HMAC_KEY;
    else process.env.COMMERCE_IDENTITY_HMAC_KEY = previous;
  }
});

test("explicit order references still require the sender identity for auto-linking", () => {
  assert.equal(orderCustomerIdentityMatches("Customer@Example.com", " customer@example.com "), true);
  assert.equal(orderCustomerIdentityMatches("other@example.com", "customer@example.com"), false);
  assert.equal(orderCustomerIdentityMatches(null, "customer@example.com"), false);
});

test("commerce identity and setup require dedicated secrets", () => {
  const previousIdentityKey = process.env.COMMERCE_IDENTITY_HMAC_KEY;
  const previousSmtpKey = process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY;
  delete process.env.COMMERCE_IDENTITY_HMAC_KEY;
  process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY = "smtp-only-secret";
  try {
    assert.throws(() => customerKey("tenant-a", "user@example.nl"), /COMMERCE_IDENTITY_HMAC_KEY/);
    const issue = commerceConfigurationIssue({});
    assert.ok(issue);
    assert.match(issue, /COMMERCE_CREDENTIAL_ENCRYPTION_KEY, COMMERCE_IDENTITY_HMAC_KEY/);
    assert.equal(commerceConfigurationIssue({
      COMMERCE_CREDENTIAL_ENCRYPTION_KEY: "encryption-key",
      COMMERCE_IDENTITY_HMAC_KEY: "identity-key",
    }), null);
  } finally {
    if (previousIdentityKey === undefined) delete process.env.COMMERCE_IDENTITY_HMAC_KEY;
    else process.env.COMMERCE_IDENTITY_HMAC_KEY = previousIdentityKey;
    if (previousSmtpKey === undefined) delete process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY = previousSmtpKey;
  }
});

test("order references and explicit cancellation intent are conservative", () => {
  assert.deepEqual(extractOrderNumbers("Annuleer bestelling #nl-1042 en order 9981"), ["NL-1042", "9981"]);
  assert.deepEqual(selectOrdersMatchingReferences([
    { id: "one", displayName: "#NL-1042" },
    { id: "two", displayName: "#9981" },
    { id: "other", displayName: "#7777" },
  ], ["NL-1042", "9981"]).map((order) => order.id), ["one", "two"]);
  assert.equal(isVerifiedOrderCandidate(["one", "two"], "other"), false);
  assert.equal(isVerifiedOrderCandidate(["one", "two"], "two"), true);
  assert.equal(hasExplicitCancellationIntent("Waar blijft mijn bestelling?"), false);
  assert.equal(hasExplicitCancellationIntent("Ik wil bestelling #9981 annuleren"), true);
});

test("cancellation policy permits the exact limit and blocks unsafe orders", () => {
  const base = {
    cancelable: true,
    cancelledAt: null,
    fulfillmentStatus: "UNFULFILLED",
    totalAmount: 250,
    maxCancelAmount: 250,
    currencyCode: "EUR",
    shopCurrency: "EUR",
  };
  assert.deepEqual(evaluateCancellation(base), { allowed: true });
  assert.equal(evaluateCancellation({ ...base, totalAmount: 250.01 }).allowed, false);
  assert.equal(evaluateCancellation({ ...base, fulfillmentStatus: "PARTIALLY_FULFILLED" }).allowed, false);
  assert.equal(evaluateCancellation({ ...base, financialStatus: "PARTIALLY_REFUNDED" }).allowed, false);
  assert.equal(evaluateCancellation({ ...base, financialStatus: "REFUNDED" }).allowed, false);
  assert.equal(evaluateCancellation({ ...base, currencyCode: "USD" }).allowed, false);
  assert.equal(evaluateCancellation({ ...base, cancelledAt: new Date().toISOString() }).allowed, false);
});

test("WooCommerce retry only relaxes a fully refunded closure", () => {
  const base = {
    cancelable: false,
    cancelledAt: null,
    financialStatus: "REFUNDED",
    fulfillmentStatus: "UNFULFILLED",
    totalAmount: 250,
    maxCancelAmount: 250,
    currencyCode: "EUR",
    shopCurrency: "EUR",
    allowFullyRefundedClosure: true,
  };
  assert.deepEqual(evaluateCancellationRetry(base), { allowed: true });
  assert.equal(evaluateCancellationRetry({ ...base, fulfillmentStatus: "FULFILLED" }).allowed, false);
  assert.equal(evaluateCancellationRetry({ ...base, totalAmount: 251 }).allowed, false);
  assert.equal(evaluateCancellationRetry({ ...base, financialStatus: "PARTIALLY_REFUNDED" }).allowed, false);
  assert.equal(evaluateCancellationRetry({ ...base, financialStatus: "PAID" }).allowed, false);
});

test("action fingerprints are retry-stable and message-bound", () => {
  const input = { tenantId: "tenant-a", conversationId: "conversation-a", sourceMessageId: "message-a", externalOrderId: "gid://shopify/Order/42" };
  assert.equal(cancellationActionFingerprint(input), cancellationActionFingerprint(input));
  assert.notEqual(cancellationActionFingerprint(input), cancellationActionFingerprint({ ...input, sourceMessageId: "message-b" }));
  assert.notEqual(cancellationActionFingerprint(input), cancellationActionFingerprint({ ...input, tenantId: "tenant-b" }));
});

test("operational median handles even samples", () => {
  assert.equal(median([]), 0);
  assert.equal(median([0.9, 0.1, 0.3, 0.2]), 0.25);
});

test("case memory is structural and pseudonymizes free-form intent labels", () => {
  const memory = buildPseudonymousCaseMemory({
    rawIntents: ["Annulering order #ABC-123 voor Sophie <sophie@example.nl>"],
    linkedOrderCount: 1,
    finalOutcome: "reply_sent",
  });
  assert.equal(memory.summary.includes("ABC-123"), false);
  assert.equal(memory.summary.includes("sophie@example.nl"), false);
  assert.equal(memory.summary.includes("Sophie"), false);
  assert.match(memory.summary, /general_support/);
  assert.equal(memory.finalOutcome, "reply_sent");
});

test("Shopify pilot scopes are an exact allowlist and tokens refresh early", () => {
  assert.equal(shopifyScopeIssue(["read_orders", "write_orders"]), null);
  assert.equal(shopifyScopeIssue(["write_orders"]), null);
  assert.match(shopifyScopeIssue(["read_orders"]) ?? "", /missing.*write_orders/i);
  assert.match(shopifyScopeIssue(["read_orders", "write_orders", "read_customers"]) ?? "", /outside.*read_customers/i);
  const now = Date.parse("2026-07-20T12:00:00.000Z");
  assert.equal(shopifyTokenNeedsRefresh("2026-07-20T12:04:59.000Z", now), true);
  assert.equal(shopifyTokenNeedsRefresh("2026-07-20T12:05:01.000Z", now), false);
});

test("operational claims require proven live provider state", () => {
  const unknown = { cancelledAt: null, financialStatus: "PAID", fulfillmentStatus: "UNFULFILLED", hasFulfillment: false };
  assert.deepEqual(unverifiedCommerceClaims("Uw bestelling is succesvol geannuleerd.", unknown), ["cancellation"]);
  assert.deepEqual(unverifiedCommerceClaims("The refund has been issued.", unknown), ["refund"]);
  assert.deepEqual(unverifiedCommerceClaims("Your order has been shipped.", unknown), ["shipping"]);
  assert.deepEqual(unverifiedCommerceClaims("We hebben uw annuleringsverzoek ontvangen.", unknown), []);
  assert.deepEqual(unverifiedCommerceClaims("Uw bestelling is geannuleerd.", { ...unknown, cancelledAt: "2026-07-20T12:00:00Z" }), []);
});

test("every blocking action keeps replies gated until a verified confirmation draft exists", () => {
  for (const status of [null, "proposed", "approved", "executing", "failed", "blocked", "rejected"]) {
    assert.equal(blockingActionAllowsReply(status, "prepared"), false);
  }
  for (const confirmationStatus of [null, "pending", "preparing", "failed"]) {
    assert.equal(blockingActionAllowsReply("succeeded", confirmationStatus), false);
  }
  assert.equal(blockingActionAllowsReply("succeeded", "prepared"), true);
});

test("cancellation confirmation detection accepts Dutch and English provider-success drafts", () => {
  assert.equal(containsCancellationConfirmation("Uw bestelling is succesvol geannuleerd."), true);
  assert.equal(containsCancellationConfirmation("We have cancelled your order."), true);
  assert.equal(containsCancellationConfirmation("We hebben uw annuleringsverzoek ontvangen."), false);
});

test("Shopify v1 operation contract stays pinned and conservative", () => {
  assert.equal(SHOPIFY_API_VERSION, "2026-07");
  assert.match(SHOPIFY_CANCEL_ORDER_MUTATION, /notifyCustomer:\s*false/);
  assert.match(SHOPIFY_CANCEL_ORDER_MUTATION, /originalPaymentMethodsRefund:\s*true/);
  assert.match(SHOPIFY_CANCEL_ORDER_MUTATION, /restock:\s*true/);
  assert.match(SHOPIFY_CANCEL_ORDER_MUTATION, /reason:\s*CUSTOMER/);
  assert.deepEqual(SHOPIFY_WEBHOOK_TOPICS, [
    "ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_CANCELLED", "ORDERS_FULFILLED", "ORDERS_PARTIALLY_FULFILLED",
  ]);
});
