import assert from "node:assert/strict";
import { test } from "node:test";

import { isSampleAddress, SAMPLE_CUSTOMER_EMAIL } from "../lib/support/sample.ts";

test("the example address is recognised and never a real one", () => {
  assert.equal(isSampleAddress(SAMPLE_CUSTOMER_EMAIL), true);
  assert.equal(isSampleAddress(" Voorbeeld@Sample.INVALID "), true);
  assert.equal(isSampleAddress("klant@guardianbeauty.nl"), false);
  assert.equal(isSampleAddress("someone@invalid.nl"), false);
  assert.equal(isSampleAddress(null), false);
});
