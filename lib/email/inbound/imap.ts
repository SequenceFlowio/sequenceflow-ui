import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";

import { decryptSmtpPassword } from "@/lib/email/outbound/smtpCredentials";
import type { ImapEncryption } from "@/lib/email/outbound/smtpPresets";
import { extractVisibleReplyText } from "@/lib/email/inbound/replyText";
import type { NormalizedInboundAttachment, NormalizedInboundEmail } from "@/types/aiInbox";

export type ImapChannelConfig = {
  id: string;
  tenantId: string;
  host: string;
  port: number;
  encryption: ImapEncryption;
  username: string;
  passwordEncrypted: string;
  mailbox: string;
  recipientEmail: string;
  uidValidity: string | null;
  lastUid: number;
};

export type ImapFetchedEmail = {
  uid: number;
  uidValidity: string;
  providerMessageId: string;
  email: NormalizedInboundEmail;
};

export function imapClientOptions(channel: ImapChannelConfig, verifyOnly = false) {
  return {
    host: channel.host,
    port: channel.port,
    secure: channel.encryption === "ssl",
    doSTARTTLS: channel.encryption === "starttls",
    disableAutoIdle: true,
    verifyOnly,
    logger: false as const,
    auth: {
      user: channel.username,
      pass: decryptSmtpPassword(channel.passwordEncrypted),
    },
  };
}

/**
 * Inbound mailbox access is deliberately read-only. Keep every source-mailbox
 * reader behind this helper so sync, history mining, and future importers can
 * never silently open a writable mailbox session.
 */
export function openImapMailboxReadOnly(client: ImapFlow, mailbox: string) {
  return client.mailboxOpen(mailbox, { readOnly: true });
}

function headerRecord(mail: ParsedMail) {
  const headers: Record<string, string> = {};
  for (const line of mail.headerLines ?? []) {
    const [key, ...rest] = line.line.split(":");
    if (!key || rest.length === 0) continue;
    headers[key.trim()] = rest.join(":").trim();
  }
  return headers;
}

function addresses(value: AddressObject | AddressObject[] | undefined) {
  const objects = Array.isArray(value) ? value : value ? [value] : [];
  return objects.flatMap((object) =>
    object.value
      .map((entry) => entry.address?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email))
  );
}

function firstAddress(value: AddressObject | AddressObject[] | undefined) {
  const objects = Array.isArray(value) ? value : value ? [value] : [];
  for (const object of objects) {
    for (const entry of object.value) {
      const email = entry.address?.trim().toLowerCase();
      if (email) return { email, name: entry.name?.trim() || null };
    }
  }
  return null;
}

function resolveCustomerSender(input: {
  from: { email: string; name: string | null };
  replyTo: { email: string; name: string | null } | null;
  recipients: string[];
}) {
  if (
    input.replyTo &&
    input.replyTo.email !== input.from.email &&
    input.recipients.includes(input.from.email)
  ) {
    return input.replyTo;
  }

  return input.from;
}

function referencesString(mail: ParsedMail) {
  if (Array.isArray(mail.references)) return mail.references.join(" ");
  return mail.references ?? null;
}

function normalizeMessageId(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("<") ? trimmed : `<${trimmed}>`;
}

function normalizeAttachments(mail: ParsedMail): NormalizedInboundAttachment[] {
  return (mail.attachments ?? []).map((attachment, index) => ({
    filename: attachment.filename?.trim() || `attachment-${index + 1}`,
    content: Buffer.from(attachment.content),
    contentType: attachment.contentType || null,
    contentId: attachment.cid || null,
  }));
}

async function normalizeParsedMail(input: {
  channel: ImapChannelConfig;
  uid: number;
  uidValidity: string;
  source: Buffer;
  internalDate?: Date | string | null;
  mailbox?: string;
}): Promise<ImapFetchedEmail> {
  const mail = await simpleParser(input.source);
  const headers = headerRecord(mail);
  const from = firstAddress(mail.from) ?? { email: "unknown@example.com", name: null };
  const replyTo = firstAddress(mail.replyTo);
  const to = addresses(mail.to);
  const cc = addresses(mail.cc);
  const bcc = addresses(mail.bcc);
  const customerSender = resolveCustomerSender({
    from,
    replyTo,
    recipients: [...to, ...cc, ...bcc],
  });
  const messageId = normalizeMessageId(mail.messageId);
  // Keep the historical format for INBOX so existing rows aren't re-imported.
  // For other folders (Spam, Junk, etc.) include the mailbox path so the same
  // UID across folders doesn't collide on the unique index.
  const isInbox = !input.mailbox || input.mailbox === "INBOX";
  const providerMessageId = isInbox
    ? `imap:${input.channel.id}:${input.uidValidity}:${input.uid}`
    : `imap:${input.channel.id}:${input.mailbox}:${input.uidValidity}:${input.uid}`;
  const rawText = String(mail.text ?? "").trim();

  return {
    uid: input.uid,
    uidValidity: input.uidValidity,
    providerMessageId,
    email: {
      provider: "imap",
      providerMessageId,
      recipient: input.channel.recipientEmail,
      from: customerSender,
      to,
      cc,
      bcc,
      subject: mail.subject ?? "",
      text: extractVisibleReplyText(rawText),
      html: typeof mail.html === "string" ? mail.html : null,
      headers,
      internetMessageId: messageId,
      inReplyTo: normalizeMessageId(mail.inReplyTo),
      references: referencesString(mail),
      receivedAt: new Date(mail.date ?? input.internalDate ?? new Date()).toISOString(),
      attachments: normalizeAttachments(mail),
    },
  };
}

export async function verifyImapChannel(channel: ImapChannelConfig) {
  const client = new ImapFlow(imapClientOptions(channel, false));
  await client.connect();
  try {
    const mailbox = await openImapMailboxReadOnly(client, channel.mailbox || "INBOX");
    return {
      uidValidity: mailbox.uidValidity.toString(),
      latestUid: Math.max(0, mailbox.uidNext - 1),
      exists: mailbox.exists,
    };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/**
 * Fetch the most recent N messages from an arbitrary mailbox (e.g. "Spam",
 * "Junk"). Does NOT do UID-cursor tracking — caller should rely on the
 * `support_messages.provider_message_id` unique index to dedupe. Used to
 * catch customer replies that landed in spam folders.
 */
export async function fetchImapMailboxTail(
  channel: ImapChannelConfig,
  mailboxName: string,
  limit = 10,
): Promise<{ found: boolean; emails: ImapFetchedEmail[] }> {
  const client = new ImapFlow(imapClientOptions(channel, false));
  await client.connect();
  try {
    let mailbox;
    try {
      mailbox = await openImapMailboxReadOnly(client, mailboxName);
    } catch {
      // Folder doesn't exist on this server (e.g. provider uses a different
      // name for Spam). Quietly skip.
      return { found: false, emails: [] };
    }

    const uidValidity = mailbox.uidValidity.toString();
    const latestUid = Math.max(0, mailbox.uidNext - 1);
    if (!latestUid) return { found: true, emails: [] };

    const startUid = Math.max(1, latestUid - limit + 1);
    const emails: ImapFetchedEmail[] = [];
    for await (const message of client.fetch(`${startUid}:${latestUid}`, {
      uid: true,
      internalDate: true,
      source: true,
    }, { uid: true })) {
      if (!message.source) continue;
      emails.push(await normalizeParsedMail({
        channel,
        uid: message.uid,
        uidValidity,
        source: message.source,
        internalDate: message.internalDate,
        mailbox: mailboxName,
      }));
    }

    return { found: true, emails };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function fetchNewImapEmails(channel: ImapChannelConfig, limit = 20) {
  const client = new ImapFlow(imapClientOptions(channel, false));
  await client.connect();
  try {
    const mailbox = await openImapMailboxReadOnly(client, channel.mailbox || "INBOX");
    const uidValidity = mailbox.uidValidity.toString();
    const latestUid = Math.max(0, mailbox.uidNext - 1);

    if (channel.uidValidity && channel.uidValidity !== uidValidity) {
      return {
        uidValidity,
        latestUid,
        emails: [] as ImapFetchedEmail[],
        uidValidityChanged: true,
      };
    }

    const startUid = Math.max(1, (channel.lastUid || 0) + 1);
    if (!latestUid || startUid > latestUid) {
      return { uidValidity, latestUid, emails: [] as ImapFetchedEmail[], uidValidityChanged: false };
    }

    const emails: ImapFetchedEmail[] = [];
    for await (const message of client.fetch(`${startUid}:${latestUid}`, {
      uid: true,
      internalDate: true,
      source: true,
    }, { uid: true })) {
      if (!message.source) continue;
      emails.push(await normalizeParsedMail({
        channel,
        uid: message.uid,
        uidValidity,
        source: message.source,
        internalDate: message.internalDate,
      }));
      if (emails.length >= limit) break;
    }

    return {
      uidValidity,
      latestUid: emails.length > 0 ? Math.max(...emails.map((email) => email.uid)) : latestUid,
      emails,
      uidValidityChanged: false,
    };
  } finally {
    await client.logout().catch(() => undefined);
  }
}
