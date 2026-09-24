import assert from "node:assert/strict";
import test from "node:test";

import { supportLabel } from "../lib/support/labels.ts";

test("ruwe pipelinewaarden worden leesbare Nederlandse labels", () => {
  assert.equal(supportLabel("intent", "order_status"), "Bestelstatus");
  assert.equal(supportLabel("intent", "fallback"), "Overig");
  assert.equal(supportLabel("status", "pending_autosend"), "Wordt automatisch verstuurd");
  assert.equal(supportLabel("decision", "human_review"), "Ter beoordeling");
});

test("labels volgen de gekozen taal", () => {
  assert.equal(supportLabel("intent", "return_request", "en"), "Return");
  assert.equal(supportLabel("status", "review", "en"), "Needs review");
});

test("onbekende of lege waarden breken niets", () => {
  assert.equal(supportLabel("intent", "brand_new_intent"), "Brand new intent");
  assert.equal(supportLabel("status", null), "");
  assert.equal(supportLabel("intent", "  ORDER_STATUS "), "Bestelstatus");
});

test("classifier variants map to the same readable topic", () => {
  assert.equal(supportLabel("intent", "order_status_inquiry", "nl"), "Bestelstatus");
  assert.equal(supportLabel("intent", "shipping_question", "en"), "Shipping");
});
