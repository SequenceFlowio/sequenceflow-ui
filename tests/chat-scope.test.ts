import test from "node:test";
import assert from "node:assert/strict";
import { parseChatScope, parseChatConversation } from "../lib/lumen/scope.ts";
test("only supported roles are accepted", () => {
  assert.equal(parseChatScope(undefined), "general");
  assert.equal(parseChatScope("mail"), "mail");
  for (const role of ["content", "admin", "inventory", {}, null]) assert.throws(() => parseChatScope(role));
});
test("mail context cannot cross into general chat", () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  assert.equal(parseChatConversation("mail", id), id);
  assert.equal(parseChatConversation("general", null), null);
  assert.throws(() => parseChatConversation("general", id));
  assert.throws(() => parseChatConversation("mail", "all"));
});
