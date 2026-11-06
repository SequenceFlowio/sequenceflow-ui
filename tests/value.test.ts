import assert from "node:assert/strict";
import test from "node:test";

import { estimateValue } from "../lib/analytics/value.ts";

test("time saved is replies × 5 minutes, valued at €25 an hour", () => {
  assert.deepEqual(estimateValue(120), { hours: 10, euros: 250 });
  assert.deepEqual(estimateValue(0), { hours: 0, euros: 0 });
  assert.deepEqual(estimateValue(-3), { hours: 0, euros: 0 });
  assert.deepEqual(estimateValue(7), { hours: 0.6, euros: 15 });
});
