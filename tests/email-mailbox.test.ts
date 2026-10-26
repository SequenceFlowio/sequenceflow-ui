import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/integrations/email/mailbox/route.ts", import.meta.url),
  "utf8",
);

test("unified mailbox setup is admin-only and tenant-bound", () => {
  assert.match(route, /context\.role !== "admin"/);
  assert.match(route, /\.eq\("tenant_id", tenantId\)/);
  assert.match(route, /\.update\(payload\)\.eq\("id", existing\.id\)\.eq\("tenant_id", tenantId\)/);
});

test("unified mailbox setup stores both encrypted credentials in one write", () => {
  assert.match(route, /imap_password_encrypted: encryptedImapPassword/);
  assert.match(route, /smtp_password_encrypted: encryptedSmtpPassword/);
  assert.match(route, /imap_status: "test_required"/);
  assert.match(route, /smtp_status: "test_required"/);
  assert.match(route, /const query = existing\?\.id[\s\S]+\.update\(payload\)[\s\S]+\.insert\(payload\)/);
  assert.doesNotMatch(route, /NextResponse\.json\([^)]*(?:encryptedImapPassword|encryptedSmtpPassword)/);
});

test("new Microsoft 365 mailbox setup requires OAuth", () => {
  assert.match(route, /imapProvider === "microsoft_365"/);
  assert.match(route, /Microsoft 365 connections require OAuth/);
  assert.match(route, /status: 409/);
});

test("an IMAP sync never undoes a disconnect, and a mailbox without details is 'not configured'", async () => {
  const { readFileSync } = await import("node:fs");
  const sync = readFileSync(new URL("../lib/email/inbound/syncImapMailbox.ts", import.meta.url), "utf8");
  assert.match(sync, /input\.username \? query\.eq\("imap_username", input\.username\) : query\.is\("imap_username", null\)/);
  assert.match(sync, /status: row\.imap_username \? "failed" : "not_configured"/);
  const settings = readFileSync(new URL("../app/(app)/settings/SupportMailboxSettings.tsx", import.meta.url), "utf8");
  assert.match(settings, /setJustDisconnected\(true\)/);
  assert.match(settings, /\) : justDisconnected \|\| microsoft\.connected \? null : \(/);
});

test("mailbox alert text explains the problem and the fix, in the workspace language", async () => {
  const { mailboxAlertText, isAuthFailure } = await import("../lib/email/mailboxAlertText.ts");
  assert.equal(isAuthFailure("Command failed (AUTHENTICATIONFAILED · Authentication failed. · authentication failed)"), true);
  assert.equal(isAuthFailure("connect ETIMEDOUT"), false);
  const nl = mailboxAlertText({ language: "nl", address: "info@winkel.nl", error: "Command failed (AUTHENTICATIONFAILED)", since: "2026-10-08T00:31:54Z", reconnectUrl: "https://support.sequenceflow.io/integrations", shopify: false });
  assert.match(nl.subject, /Actie nodig/);
  assert.match(nl.text, /weigert het wachtwoord/);
  assert.match(nl.text, /8 oktober 2026/);
  assert.match(nl.text, /https:\/\/support\.sequenceflow\.io\/integrations/);
  assert.match(nl.text, /Opslaan en verbinding testen/);
  const en = mailboxAlertText({ language: "en", address: null, error: "ETIMEDOUT", since: null, reconnectUrl: "x", shopify: true, direction: "send" });
  assert.match(en.subject, /cannot send/);
  assert.match(en.text, /Open Support One in Shopify/);
  assert.doesNotMatch(en.text, /rejects the password/);
});

test("IMAP sync: per-email progress, a time budget, and alerts only on a repeated mailbox failure", () => {
  const sync = readFileSync(new URL("../lib/email/inbound/syncImapMailbox.ts", import.meta.url), "utf8");
  assert.match(sync, /if \(Date\.now\(\) > deadline\) \{ stoppedEarly = true; break; \}/);
  assert.match(sync, /await saveProgress\(row, lastUid\)/);
  assert.match(sync, /lastUid: stoppedEarly \? lastUid : Math\.max\(lastUid, fetched\.latestUid\)/);
  assert.match(sync, /if \(row\.imap_status === "failed"\) \{\s*await alertMailboxProblem\(\{[^}]*audience: "workspace"/);
  assert.match(sync, /audience: "team"/);
  const cron = readFileSync(new URL("../app/api/cron/process-emails/route.ts", import.meta.url), "utf8");
  assert.match(cron, /maxDuration = 60/);
  const mailer = readFileSync(new URL("../lib/email/outbound/mailer.ts", import.meta.url), "utf8");
  assert.match(mailer, /direction: "send"/);
});
