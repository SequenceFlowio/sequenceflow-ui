import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry) ? [path] : [];
  });
}

test("source mailboxes stay read-only and provider messages cannot be removed", () => {
  const files = [...sourceFiles(join(root, "app")), ...sourceFiles(join(root, "lib"))];
  const sources = files.map((path) => ({ path: relative(root, path), content: readFileSync(path, "utf8") }));
  const directMailboxOpens = sources
    .filter(({ content }) => content.includes(".mailboxOpen("))
    .map(({ path }) => path);

  assert.deepEqual(directMailboxOpens, ["lib/email/inbound/imap.ts"]);

  const imap = sources.find(({ path }) => path === "lib/email/inbound/imap.ts")?.content ?? "";
  assert.equal((imap.match(/\.mailboxOpen\(/g) ?? []).length, 1);
  assert.match(imap, /return client\.mailboxOpen\(mailbox, \{ readOnly: true \}\)/);

  const providerMutation = /\.(?:messageDelete|messageMove|messageFlagsAdd|messageFlagsRemove|mailboxDelete|mailboxRename|expunge)\s*\(/;
  const gmailRemoval = /users\.(?:messages|threads|drafts)\.(?:delete|trash)\s*\(/;

  for (const source of sources) {
    assert.doesNotMatch(source.content, providerMutation, `${source.path} mutates a source mailbox`);
    assert.doesNotMatch(source.content, gmailRemoval, `${source.path} removes Gmail provider mail`);
  }
});

test("local retention cannot connect to or mutate a provider mailbox", () => {
  const cleanup = readFileSync(join(root, "app/api/cron/cleanup-old-email/route.ts"), "utf8");
  assert.doesNotMatch(cleanup, /imapflow|googleapis|gmail\/v1/i);
  assert.match(cleanup, /Retention only removes SequenceFlow's stored copy/);
});
