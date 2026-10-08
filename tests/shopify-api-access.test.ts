import assert from "node:assert/strict";
import { test } from "node:test";
import { shopifyApiAllowed } from "../lib/shopify/apiAccess.ts";

test("Shopify staff can review tickets but cannot administer billing, integrations, or users", () => {
  assert.equal(shopifyApiAllowed("/api/tickets", "GET", "agent"), true);
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234/approve-send", "POST", "agent"), true);
  assert.equal(shopifyApiAllowed("/api/integrations/email/mailbox", "POST", "agent"), false);
  assert.equal(shopifyApiAllowed("/api/integrations/email/mailbox", "POST", "admin"), true);
  assert.equal(shopifyApiAllowed("/api/billing/checkout", "POST", "admin"), false);
  assert.equal(shopifyApiAllowed("/api/billing/portal", "POST", "admin"), false);
  assert.equal(shopifyApiAllowed("/api/team", "POST", "admin"), false);
  assert.equal(shopifyApiAllowed("/api/commerce/actions/abc/approve", "POST", "admin"), false);
  assert.equal(shopifyApiAllowed("/api/autosend-config", "POST", "admin"), false);
});

test("everything the embedded inbox needs is reachable", () => {
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234", "PATCH", "agent"), true, "saving an edited draft");
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234/send", "POST", "agent"), true);
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234/schedule-send", "POST", "agent"), true, "scheduling after human review");
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234/commerce-context", "GET", "agent"), true);
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234/commerce-context", "POST", "agent"), true, "confirming the right order");
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234/translate", "POST", "agent"), true);
  assert.equal(shopifyApiAllowed("/api/agent-config", "GET", "agent"), true);
  assert.equal(shopifyApiAllowed("/api/shopify/sample", "POST", "agent"), true, "try an example");
});

test("destructive actions stay with the shop owner", () => {
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234", "DELETE", "agent"), false);
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234", "DELETE", "admin"), true);
  assert.equal(shopifyApiAllowed("/api/knowledge/upload", "POST", "agent"), false);
  assert.equal(shopifyApiAllowed("/api/agent-config", "POST", "admin"), false);
});

test("embedded admins can sign in with Google for sending; staff and other methods cannot", () => {
  assert.equal(shopifyApiAllowed("/api/integrations/email/google/start", "POST", "admin"), true);
  assert.equal(shopifyApiAllowed("/api/integrations/email/google/test", "POST", "admin"), true);
  assert.equal(shopifyApiAllowed("/api/integrations/email/google", "DELETE", "admin"), true);
  assert.equal(shopifyApiAllowed("/api/integrations/email/google/start", "POST", "agent"), false);
  assert.equal(shopifyApiAllowed("/api/integrations/email/google", "DELETE", "agent"), false);
  assert.equal(shopifyApiAllowed("/api/integrations/email/google/start", "GET", "admin"), false);
  // The callback runs in its own window on the one-time state, never through Shopify.
  assert.equal(shopifyApiAllowed("/api/integrations/email/google/callback", "GET", "admin"), false);
});
