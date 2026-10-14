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
  assert.match(settings, /\) : justDisconnected \? null : \(/);
});
