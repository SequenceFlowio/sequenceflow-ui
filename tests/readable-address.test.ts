import assert from "node:assert/strict";
import test from "node:test";

import { isGeneratedInboundAddress, readableAddressBase, readableAddressCandidates, slugForAddress } from "../lib/email/inbound/readableAddressCore.ts";

test("forwarding addresses become readable names", () => {
  assert.equal(readableAddressBase({ shopDomain: "guardian-beauty.myshopify.com" }), "guardian-beauty");
  assert.equal(readableAddressBase({ supportEmail: "support@guardianbeauty.nl" }), "guardianbeauty");
  assert.equal(readableAddressBase({ supportEmail: "guardian.beauty@gmail.com" }), "guardian-beauty");
  assert.equal(readableAddressBase({ tenantName: "Tenant f9d4da74" }), "", "generated names are not shown");
  assert.equal(slugForAddress("Crème & Co. Beauté!"), "creme-co-beaute");
});

test("collisions get a number; too-short names keep the old address", () => {
  assert.deepEqual(readableAddressCandidates("guardianbeauty", "inbox.example.io", 3), [
    "guardianbeauty@inbox.example.io", "guardianbeauty-2@inbox.example.io", "guardianbeauty-3@inbox.example.io",
  ]);
  assert.deepEqual(readableAddressCandidates("ab", "inbox.example.io"), []);
});

test("only generated t-<uuid> addresses are replaced", () => {
  assert.equal(isGeneratedInboundAddress("t-5b2ed73e-f004-4c0e-9dff-8ec6586d34e4@inbox.emailreply.sequenceflow.io"), true);
  assert.equal(isGeneratedInboundAddress("guardianbeauty@inbox.emailreply.sequenceflow.io"), false);
});

test("a taken shop alias falls back to the mailbox name before numbering", async () => {
  const { readableAddressBases } = await import("../lib/email/inbound/readableAddressCore.ts");
  assert.deepEqual(readableAddressBases({ shopDomain: "sequenceflow-test.myshopify.com", supportEmail: "sequenceflownl@gmail.com", tenantName: "Tenant 8f551666" }), ["sequenceflow-test", "sequenceflownl"]);
  assert.deepEqual(readableAddressBases({ shopDomain: null, supportEmail: "info@guardianbeauty.nl", tenantName: "Guardian" }), ["guardianbeauty", "guardian"]);
});
