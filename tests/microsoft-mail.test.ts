import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MICROSOFT_MAIL_SCOPES,
  buildMicrosoftAuthUrl,
  grantedMailScopes,
  inboxQuery,
  isRevokedGrant,
  mailboxAddress,
  microsoftProviderMessageId,
  newOAuthState,
  newPkcePair,
  nextCursor,
} from "../lib/email/microsoft/core.ts";

test("sign-in asks for read and send only, never write access, with PKCE", () => {
  const { challenge } = newPkcePair();
  const { state } = newOAuthState();
  const url = new URL(buildMicrosoftAuthUrl({ clientId: "app-id", redirectUri: "https://support.sequenceflow.io/api/integrations/email/microsoft/callback", state, codeChallenge: challenge, loginHint: "info@winkel.nl" }));
  assert.equal(url.origin + url.pathname, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  const scopes = url.searchParams.get("scope") ?? "";
  assert.equal(scopes, MICROSOFT_MAIL_SCOPES.join(" "));
  assert.match(scopes, /offline_access/);
  assert.match(scopes, /Mail\.Read(\s|$)/);
  assert.match(scopes, /Mail\.Send/);
  assert.doesNotMatch(scopes, /ReadWrite|Mail\.ReadBasic|\.All/);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("state"), state);
  assert.equal(url.searchParams.get("login_hint"), "info@winkel.nl");
});

test("both reading and sending must be granted", () => {
  assert.equal(grantedMailScopes("https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read"), true);
  assert.equal(grantedMailScopes("Mail.Read Mail.Send User.Read profile openid"), true);
  assert.equal(grantedMailScopes("https://graph.microsoft.com/Mail.Send"), false);
  assert.equal(grantedMailScopes(""), false);
});

test("the mailbox address prefers mail and skips guest principal names", () => {
  assert.equal(mailboxAddress({ mail: "Info@Winkel.NL", userPrincipalName: "info@winkel.onmicrosoft.com" }), "info@winkel.nl");
  assert.equal(mailboxAddress({ mail: null, userPrincipalName: "jan@outlook.com" }), "jan@outlook.com");
  assert.equal(mailboxAddress({ mail: null, userPrincipalName: "jan_gmail.com#EXT#@winkel.onmicrosoft.com" }), null);
});

test("messages are keyed on the Internet Message-ID, which survives folder moves", () => {
  assert.equal(microsoftProviderMessageId({ id: "AAMk1", internetMessageId: "<abc@mail.outlook.com>" }), "microsoft:<abc@mail.outlook.com>");
  assert.equal(microsoftProviderMessageId({ id: "AAMk1", internetMessageId: null }), "microsoft:AAMk1");
});

test("the inbox is read forward from the cursor and the cursor never moves back", () => {
  const url = new URL(inboxQuery("inbox", "2026-10-26T10:00:00Z", 20));
  assert.equal(url.pathname, "/v1.0/me/mailFolders/inbox/messages");
  assert.equal(url.searchParams.get("$filter"), "receivedDateTime ge 2026-10-26T10:00:00.000Z");
  assert.equal(url.searchParams.get("$orderby"), "receivedDateTime asc");
  assert.equal(nextCursor("2026-10-26T10:00:00.000Z", []), "2026-10-26T10:00:00.000Z");
  assert.equal(nextCursor("2026-10-26T10:00:00.000Z", [{ receivedDateTime: "2026-10-26T10:05:00Z" }, { receivedDateTime: "2026-10-26T10:02:00Z" }]), "2026-10-26T10:05:00.000Z");
  assert.equal(nextCursor("2026-10-26T10:00:00.000Z", [{ receivedDateTime: "2026-10-26T09:00:00Z" }]), "2026-10-26T10:00:00.000Z");
});

test("a revoked grant asks for a new sign-in", () => {
  assert.equal(isRevokedGrant(400, { error: "invalid_grant" }), true);
  assert.equal(isRevokedGrant(400, { error: "interaction_required" }), true);
  assert.equal(isRevokedGrant(500, { error: "temporarily_unavailable" }), false);
});

test("the Microsoft mailbox is only ever read with GET, plus sendMail", () => {
  const sources = ["lib/email/microsoft/connection.ts", "lib/email/microsoft/syncMailbox.ts"].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
  for (const source of sources) {
    assert.doesNotMatch(source, /method:\s*"(DELETE|PATCH|PUT)"/);
    assert.doesNotMatch(source, /\/(move|copy)\b|isRead|flag/);
    const posts = [...source.matchAll(/fetch\(([^,]+),\s*\{\s*method:\s*"POST"/g)].map((match) => match[1].trim());
    for (const target of posts) assert.match(target, /MICROSOFT_TOKEN_URL|\/me\/sendMail/);
  }
});
