import assert from "node:assert/strict";
import test from "node:test";

import { emailLoginError, normalizeCode, normalizeEmail } from "../lib/auth/emailLoginCore.ts";
import { TURNSTILE_VERIFY_URL, verifyTurnstileWith } from "../lib/security/turnstileCore.ts";

const reply = (data: unknown) => async () => ({ ok: true, json: async () => data });

test("zonder geheime sleutel slaat Turnstile de check over", async () => {
  const result = await verifyTurnstileWith(undefined, "1.2.3.4", { secret: undefined, fetchImpl: () => { throw new Error("mag niet"); } });
  assert.deepEqual(result, { ok: true, skipped: true });
});

test("met sleutel is een token verplicht en vraagt Cloudflare om akkoord", async () => {
  assert.deepEqual(await verifyTurnstileWith("", "1.2.3.4", { secret: "s", fetchImpl: reply({ success: true }) }), { ok: false, reason: "missing-token" });
  let sent: URLSearchParams | null = null;
  let url = "";
  const ok = await verifyTurnstileWith("tok", "1.2.3.4", { secret: "s", fetchImpl: async (to, init) => { url = to; sent = init.body; return { ok: true, json: async () => ({ success: true }) }; } });
  assert.deepEqual(ok, { ok: true, skipped: false });
  assert.equal(url, TURNSTILE_VERIFY_URL);
  assert.equal(sent!.get("response"), "tok");
  assert.equal(sent!.get("remoteip"), "1.2.3.4");
  assert.deepEqual(await verifyTurnstileWith("tok", "unknown", { secret: "s", fetchImpl: reply({ success: false, "error-codes": ["timeout-or-duplicate"] }) }), { ok: false, reason: "timeout-or-duplicate" });
});

test("is Cloudflare onbereikbaar, dan gaat een aanmelding gewoon door", async () => {
  const result = await verifyTurnstileWith("tok", "1.2.3.4", { secret: "s", fetchImpl: async () => { throw new Error("offline"); } });
  assert.deepEqual(result, { ok: true, skipped: true });
});

test("e-mail en code uit de mail worden netjes gelezen", () => {
  assert.equal(normalizeEmail("  Jan@Shop.NL "), "jan@shop.nl");
  assert.equal(normalizeEmail("geen-mail"), null);
  assert.equal(normalizeCode("123 456"), "123456");
  assert.equal(normalizeCode("12345"), null);
  assert.equal(normalizeCode("abcdef"), null);
});

test("foutmeldingen van Supabase worden begrijpelijk", () => {
  assert.match(emailLoginError("captcha protection: request disallowed", "nl"), /botcheck/);
  assert.match(emailLoginError("For security purposes, you can only request this after 42 seconds.", "en"), /Wait a minute/);
  assert.match(emailLoginError("Token has expired or is invalid", "nl"), /verlopen/);
  assert.match(emailLoginError(undefined, "nl"), /Google/);
});
