import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import { imapClientOptions, type ImapChannelConfig } from "@/lib/email/inbound/imap";

/**
 * Read-only, resumable reader over a mailbox folder's history. Used by the
 * onboarding mining pipeline to walk 6–12 months of the tenant's Sent folder
 * (and INBOX) without touching the live poller's UID cursors.
 */
export type HistoryMessage = {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  fromEmail: string | null;
  toEmail: string | null;
  subject: string;
  date: string | null; // ISO
  text: string;
};

export type HistoryPage = {
  folderPath: string | null;
  messages: HistoryMessage[];
  /** Resume cursor: pass as `afterUid` on the next call. */
  nextUid: number;
  done: boolean;
};

const SENT_FOLDER_CANDIDATES = [
  "Sent",
  "Sent Items",
  "Sent Messages",
  "INBOX.Sent",
  "[Gmail]/Sent Mail",
  "Verzonden",
  "Verzonden items",
] as const;

function normalizeId(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function resolveFolder(client: ImapFlow, folder: "sent" | "inbox"): Promise<string | null> {
  if (folder === "inbox") return "INBOX";
  const boxes = await client.list();
  for (const box of boxes) {
    if (box.specialUse === "\\Sent") return box.path;
  }
  const known = new Set(boxes.map((box) => box.path));
  return SENT_FOLDER_CANDIDATES.find((name) => known.has(name)) ?? null;
}

/**
 * Fetch one page of history from `folder`, oldest→newest, starting after
 * `afterUid`, restricted to messages received since `sinceDate`.
 */
export async function fetchMailboxHistory(
  channel: ImapChannelConfig,
  input: { folder: "sent" | "inbox"; sinceDate: Date; afterUid?: number; limit?: number },
): Promise<HistoryPage> {
  const limit = input.limit ?? 50;
  const afterUid = input.afterUid ?? 0;
  const client = new ImapFlow(imapClientOptions(channel));
  await client.connect();
  try {
    const folderPath = await resolveFolder(client, input.folder);
    if (!folderPath) return { folderPath: null, messages: [], nextUid: afterUid, done: true };

    await client.mailboxOpen(folderPath, { readOnly: true });

    // SEARCH by date once, then walk the matching UIDs in ascending order.
    const uids = ((await client.search({ since: input.sinceDate }, { uid: true })) || [])
      .filter((uid) => uid > afterUid)
      .sort((a, b) => a - b);

    const pageUids = uids.slice(0, limit);
    if (pageUids.length === 0) {
      return { folderPath, messages: [], nextUid: afterUid, done: true };
    }

    const messages: HistoryMessage[] = [];
    for await (const message of client.fetch(pageUids, { uid: true, source: true }, { uid: true })) {
      if (!message.source) continue;
      const mail = await simpleParser(message.source);
      const fromEmail = mail.from?.value?.[0]?.address?.toLowerCase() ?? null;
      const toValue = Array.isArray(mail.to) ? mail.to[0] : mail.to;
      const toEmail = toValue?.value?.[0]?.address?.toLowerCase() ?? null;
      const references = Array.isArray(mail.references)
        ? mail.references
        : mail.references
          ? [mail.references]
          : [];
      messages.push({
        uid: message.uid,
        messageId: normalizeId(mail.messageId),
        inReplyTo: normalizeId(mail.inReplyTo),
        references: references.map((ref) => ref.trim()).filter(Boolean),
        fromEmail,
        toEmail,
        subject: mail.subject ?? "",
        date: mail.date ? mail.date.toISOString() : null,
        text: String(mail.text ?? "").trim(),
      });
    }

    const nextUid = pageUids[pageUids.length - 1];
    return { folderPath, messages, nextUid, done: pageUids.length === uids.length };
  } finally {
    await client.logout().catch(() => undefined);
  }
}
