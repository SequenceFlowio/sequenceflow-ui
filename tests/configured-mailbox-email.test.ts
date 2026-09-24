import assert from "node:assert/strict";
import test from "node:test";

import { configuredMailboxEmail } from "../lib/email/outbound/configuredMailboxEmail.ts";

test("a new mailbox does not inherit the app's fallback sender address", () => {
  assert.equal(configuredMailboxEmail({ smtp: { fromEmail: "reply@inbox.emailreply.sequenceflow.io" } }), "");
});

test("an existing mailbox keeps its real address while editing settings", () => {
  assert.equal(configuredMailboxEmail({ smtp: { host: "smtp.gmail.com", fromEmail: "help@store.nl" } }), "help@store.nl");
  assert.equal(configuredMailboxEmail({ imap: { host: "imap.gmail.com", username: "help@store.nl" } }), "help@store.nl");
  assert.equal(configuredMailboxEmail({
    smtp: { fromEmail: "reply@inbox.emailreply.sequenceflow.io" },
    imap: { host: "imap.gmail.com", username: "help@store.nl" },
  }), "help@store.nl");
});
