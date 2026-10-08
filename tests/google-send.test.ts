import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GMAIL_SEND_SCOPE,
  buildGoogleAuthUrl,
  extractForwardingCode,
  forwardingAllowed,
  forwardingRequester,
  gmailRawMessage,
  grantedSendScope,
  hashState,
  isRevokedGrant,
  newOAuthState,
  newPkcePair,
  readIdToken,
  sameMailbox,
} from "../lib/email/google/core.ts";

const clientId = "123.apps.googleusercontent.com";
const idToken = (claims: Record<string, unknown>) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
const valid = { iss: "https://accounts.google.com", aud: clientId, exp: Math.floor(Date.now() / 1000) + 600, email: "Support@Winkel.NL", email_verified: true, sub: "42" };

test("sign-in asks only for identity and send, with PKCE and a one-time state", () => {
  const { verifier, challenge } = newPkcePair();
  assert.equal(challenge, crypto.createHash("sha256").update(verifier).digest("base64url"));
  const { state, stateHash } = newOAuthState();
  assert.equal(stateHash, hashState(state));
  assert.notEqual(state, stateHash);
  const url = new URL(buildGoogleAuthUrl({ clientId, redirectUri: "https://support.sequenceflow.io/api/integrations/email/google/callback", state, codeChallenge: challenge }));
  assert.equal(url.searchParams.get("scope"), `openid email ${GMAIL_SEND_SCOPE}`);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("state"), state);
  assert.doesNotMatch(url.toString(), /gmail\.(readonly|modify)|mail\.google\.com/);
});

test("sending needs the gmail.send scope to actually be granted", () => {
  assert.equal(grantedSendScope(`openid ${GMAIL_SEND_SCOPE} email`), true);
  assert.equal(grantedSendScope("openid email"), false);
  assert.equal(grantedSendScope(undefined), false);
});

test("identity token is checked for issuer, audience, expiry and a verified email", () => {
  assert.deepEqual(readIdToken(idToken(valid), clientId), { sub: "42", email: "support@winkel.nl" });
  assert.throws(() => readIdToken(idToken({ ...valid, aud: "other" }), clientId), /not for this app/);
  assert.throws(() => readIdToken(idToken({ ...valid, iss: "https://evil.example" }), clientId), /wrong issuer/);
  assert.throws(() => readIdToken(idToken({ ...valid, exp: 1 }), clientId), /expired/);
  assert.throws(() => readIdToken(idToken({ ...valid, email_verified: false }), clientId), /not verified/);
  assert.throws(() => readIdToken("garbage", clientId), /invalid identity token/);
});

test("Gmail addresses match regardless of dots, +tags and case", () => {
  assert.equal(sameMailbox("Guardian.Beauty+support@gmail.com", "guardianbeauty@googlemail.com"), true);
  assert.equal(sameMailbox("support@winkel.nl", "SUPPORT@winkel.nl"), true);
  assert.equal(sameMailbox("sup.port@winkel.nl", "support@winkel.nl"), false);
  assert.equal(sameMailbox("", ""), false);
});

test("forwarding is only auto-confirmed for the workspace's own mailbox", () => {
  const recipient = "t-0f8e2c1a-1111-2222-3333-444455556666@inbox.emailreply.sequenceflow.io";
  const mail = {
    subject: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from shop.owner@gmail.com",
    text: `shop.owner@gmail.com has requested to automatically forward mail to your email address ${recipient}.\nConfirmation code: 123456789\nforwarding-noreply@google.com`,
    recipient,
  };
  const requester = forwardingRequester(mail);
  assert.equal(requester, "shop.owner@gmail.com");
  assert.equal(forwardingAllowed(requester, ["shopowner@gmail.com", null]), true);
  assert.equal(forwardingAllowed(requester, ["support@winkel.nl"]), false);
  assert.equal(forwardingAllowed(null, ["support@winkel.nl"]), false);
  assert.equal(extractForwardingCode(`${mail.subject}\n${mail.text}`), "123456789");
});

test("a revoked or expired grant asks for a new sign-in", () => {
  assert.equal(isRevokedGrant(400, { error: "invalid_grant" }), true);
  assert.equal(isRevokedGrant(400, { error: "invalid_request" }), false);
  assert.equal(isRevokedGrant(500, {}), false);
});

test("Gmail API gets the message base64url-encoded", () => {
  assert.equal(gmailRawMessage("Subject: ?\r\n\r\n>>"), Buffer.from("Subject: ?\r\n\r\n>>").toString("base64url"));
  assert.doesNotMatch(gmailRawMessage("a?b>c~"), /[+/=]/);
});

test("Google sign-in tables are server-only and the state is single use", () => {
  const sql = readFileSync(new URL("../supabase/migrations/050_google_send.sql", import.meta.url), "utf8");
  for (const table of ["tenant_google_connections", "google_oauth_states"]) {
    assert.match(sql, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`REVOKE ALL ON ${table} FROM anon, authenticated`));
  }
  assert.match(sql, /used_at IS NULL AND s\.expires_at > now\(\)/);
  assert.match(sql, /outbound_provider text NOT NULL DEFAULT 'smtp'/);
});

test("Gmail sends never fall back silently to another sender", () => {
  const mailer = readFileSync(new URL("../lib/email/outbound/mailer.ts", import.meta.url), "utf8");
  const gmailBranch = mailer.slice(mailer.indexOf('outbound_provider === "gmail_api"'), mailer.indexOf("const smtpChannel = buildSmtpChannel"));
  assert.match(gmailBranch, /sendViaGmail/);
  assert.match(gmailBranch, /return \{ id: result\.id, provider: "gmail_api"/);
  assert.doesNotMatch(gmailBranch, /catch/);
  // The sample guard still runs before any provider is chosen.
  assert.ok(mailer.indexOf("isSampleAddress(input.to)") < mailer.indexOf('outbound_provider === "gmail_api"'));
});
