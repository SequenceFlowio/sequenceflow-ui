import assert from "node:assert/strict";
import test from "node:test";

import { commerceEventRetryDelayMs } from "../lib/commerce/eventsCore.ts";

test("commerce event retries back off exponentially and cap at one hour", () => {
  assert.equal(commerceEventRetryDelayMs(1), 60_000);
  assert.equal(commerceEventRetryDelayMs(2), 120_000);
  assert.equal(commerceEventRetryDelayMs(6), 1_920_000);
  assert.equal(commerceEventRetryDelayMs(20), 3_600_000);
});
