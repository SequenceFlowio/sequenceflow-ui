import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { startGoogleSignIn } from "../lib/auth/startGoogleSignIn.ts";

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseKey: "test-anon-key",
  callbackUrl: "https://support.sequenceflow.io/auth/callback?next=%2Fdashboard",
  cookies: [],
};

test("Google redirect includes a cookie whose verifier matches the PKCE challenge", async () => {
  const result = await startGoogleSignIn(config);
  const url = new URL(result.url);
  assert.equal(url.searchParams.get("provider"), "google");
  assert.equal(url.searchParams.get("redirect_to"), config.callbackUrl);
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  const cookie = result.cookies.find(item => item.name.endsWith("-code-verifier"));
  assert.ok(cookie);
  const verifier = JSON.parse(Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString()) as string;
  assert.equal(createHash("sha256").update(verifier).digest("base64url"), url.searchParams.get("code_challenge"));
  assert.equal(cookie.options.path, "/");
  assert.equal(cookie.options.sameSite, "lax");
});

test("a stale verifier is replaced by a new matching challenge before redirect", async () => {
  const first = await startGoogleSignIn(config);
  const second = await startGoogleSignIn({ ...config, cookies: first.cookies });
  const firstVerifier = first.cookies.find(item => item.name.endsWith("-code-verifier"));
  const secondVerifier = second.cookies.find(item => item.name.endsWith("-code-verifier"));
  assert.notEqual(firstVerifier?.value, secondVerifier?.value);
  assert.notEqual(new URL(first.url).searchParams.get("code_challenge"), new URL(second.url).searchParams.get("code_challenge"));
});
