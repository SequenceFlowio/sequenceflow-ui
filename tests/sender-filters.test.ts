import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSenderFilterEmail } from "../lib/email/inbound/senderFilterIdentity.ts";

test("sender filters normalize exact addresses and reject unsafe input", () => {
  assert.equal(normalizeSenderFilterEmail("  Fulfilment@Partner.NL "), "fulfilment@partner.nl");
  assert.equal(normalizeSenderFilterEmail("not-an-email"), null);
  assert.equal(normalizeSenderFilterEmail("a @partner.nl"), null);
  assert.equal(normalizeSenderFilterEmail(null), null);
});
