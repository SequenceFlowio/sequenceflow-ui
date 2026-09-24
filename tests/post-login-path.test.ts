import assert from "node:assert/strict";
import test from "node:test";

import { postLoginPath } from "../lib/auth/postLoginPath.ts";

test("sign-in opens Overview for ordinary entry and inbox index links", () => {
  assert.equal(postLoginPath(null), "/dashboard");
  assert.equal(postLoginPath("/inbox"), "/dashboard");
  assert.equal(postLoginPath("/inbox?tab=review"), "/dashboard");
});

test("sign-in keeps a direct conversation link within the app", () => {
  assert.equal(postLoginPath("/inbox/123?panel=context"), "/inbox/123?panel=context");
  assert.equal(postLoginPath("https://example.com"), "/dashboard");
  assert.equal(postLoginPath("//example.com"), "/dashboard");
});
