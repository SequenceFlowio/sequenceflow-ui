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

test("examples run on their own allowance, also before a plan is chosen", async () => {
  const { readFileSync } = await import("node:fs");
  const route = readFileSync(new URL("../app/api/shopify/sample/route.ts", import.meta.url), "utf8");
  const pipeline = readFileSync(new URL("../lib/pipeline/runInboundEmailPipeline.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /checkAiAnswerLimit/, "a missing plan must not block the example");
  assert.match(route, /reserve_shopify_sample/);
  assert.match(route, /sample: true/);
  // The plan limit is only skipped for a server-flagged run from the example address.
  assert.match(pipeline, /input\.sample === true && isSampleAddress\(input\.email\.from\.email\)/);
});
