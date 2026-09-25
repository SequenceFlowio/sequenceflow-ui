import assert from "node:assert/strict";
import { test } from "node:test";
import { isCurrentSupportDraft } from "../lib/support/draftFreshness.ts";
test("a reply belongs to the latest inbound message, including after quota or provider failure", () => {
  assert.equal(isCurrentSupportDraft({ source_message_id: "message-1" }, "message-1"), true);
  assert.equal(isCurrentSupportDraft({ source_message_id: "message-1" }, "message-2"), false);
  assert.equal(isCurrentSupportDraft({ source_message_id: null }, "message-2"), false);
  assert.equal(isCurrentSupportDraft(null, "message-2"), false);
  assert.equal(isCurrentSupportDraft({}, null), false);
});
