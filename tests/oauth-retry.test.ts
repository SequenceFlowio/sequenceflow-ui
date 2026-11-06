import assert from "node:assert/strict";
import test from "node:test";

import { shouldRetryOAuth } from "../lib/auth/oauthRetry.ts";

test("a missing PKCE verifier restarts the sign-in once, never twice", () => {
  const message = "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device";
  assert.equal(shouldRetryOAuth(message, false), true);
  assert.equal(shouldRetryOAuth(message, true), false);
  assert.equal(shouldRetryOAuth("invalid flow state, no valid flow state found", false), true);
  assert.equal(shouldRetryOAuth("Email not confirmed", false), false);
  assert.equal(shouldRetryOAuth(null, false), false);
});
