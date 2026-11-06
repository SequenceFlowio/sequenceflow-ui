import assert from "node:assert/strict";
import test from "node:test";

import { shopGid } from "../lib/shopify/appEvents.ts";

test("shop ids are sent as Shopify GIDs", () => {
  assert.equal(shopGid(23423423), "gid://shopify/Shop/23423423");
  assert.equal(shopGid("23423423"), "gid://shopify/Shop/23423423");
  assert.equal(shopGid("gid://shopify/Shop/1"), "gid://shopify/Shop/1");
});
