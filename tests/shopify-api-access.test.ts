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
});

test("destructive actions stay with the shop owner", () => {
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234", "DELETE", "agent"), false);
  assert.equal(shopifyApiAllowed("/api/tickets/abcd-1234", "DELETE", "admin"), true);
  assert.equal(shopifyApiAllowed("/api/knowledge/upload", "POST", "agent"), false);
  assert.equal(shopifyApiAllowed("/api/agent-config", "POST", "admin"), false);
});
