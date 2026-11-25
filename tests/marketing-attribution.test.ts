import assert from "node:assert/strict";
import test from "node:test";

import { attributionCookieOptions, hasSource, shouldReplaceAttribution } from "../lib/marketing/attributionCore.ts";

test("de herkomst-cookie geldt voor heel sequenceflow.io, ook de app", () => {
  assert.equal(attributionCookieOptions("www.sequenceflow.io", true).domain, ".sequenceflow.io");
  assert.equal(attributionCookieOptions("sequenceflow.io:443", true).domain, ".sequenceflow.io");
  assert.equal(attributionCookieOptions("localhost:3000", false).domain, undefined);
  assert.equal(attributionCookieOptions("evilsequenceflow.io", true).domain, undefined);
});

test("doorklikken binnen de site overschrijft de echte bron niet", () => {
  const meta = { utm_source: "meta", utm_campaign: "q4", referrer: "https://l.facebook.com/" };
  const internal = { referrer: "https://www.sequenceflow.io/nl" };
  assert.equal(shouldReplaceAttribution(null, internal), true);
  assert.equal(shouldReplaceAttribution(meta, internal), false);
  assert.equal(shouldReplaceAttribution(meta, { referrer: null }), false);
  // een nieuwe campagne of een andere site telt wel (laatste echte klik)
  assert.equal(shouldReplaceAttribution(meta, { gclid: "abc" }), true);
  assert.equal(shouldReplaceAttribution(meta, { referrer: "https://www.google.nl/" }), true);
  assert.equal(hasSource({ referrer: "https://support.sequenceflow.io/login" }), false);
  assert.equal(hasSource({ referrer: "niet-een-url" }), false);
});
