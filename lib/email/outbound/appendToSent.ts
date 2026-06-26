import { ImapFlow } from "imapflow";

import { decryptSmtpPassword } from "@/lib/email/outbound/smtpCredentials";
import type { SmtpEncryption } from "@/lib/email/outbound/smtpPresets";

/**
 * Minimal IMAP connection details needed to append a sent message to the
 * mailbox's "Sent" folder. Mirrors the IMAP columns on tenant_email_channels.
 */
export type SentAppendImapConfig = {
  host: string;
  port: number;
  encryption: SmtpEncryption;
  username: string;
  passwordEncrypted: string;
};

/**
 * Fallback folder names to try when the server doesn't advertise a
 * `\Sent` special-use mailbox. Covers the common providers ReplyOS targets.
 */
const SENT_MAILBOX_CANDIDATES = [
  "Sent",
  "Sent Items",
  "Sent Messages",
  "INBOX.Sent",
  "[Gmail]/Sent Mail",
  "Verzonden",
  "Verzonden items",
] as const;

function imapClientOptions(config: SentAppendImapConfig) {
  return {
    host: config.host,
    port: config.port,
    secure: config.encryption === "ssl",
    doSTARTTLS: config.encryption === "starttls",
    disableAutoIdle: true,
    logger: false as const,
    auth: {
      user: config.username,
      pass: decryptSmtpPassword(config.passwordEncrypted),
    },
  };
}

/**
 * Append a raw RFC-822 message to the mailbox's Sent folder so SMTP-sent
 * replies show up in the customer's own webmail "Sent"/"Verzonden" view,
 * exactly as if they'd sent it manually. Best-effort: any failure is logged
 * and swallowed so it can never block the actual customer send.
 *
 * Returns the folder path it appended to, or null if it couldn't.
 */
export async function appendToSentFolder(
  config: SentAppendImapConfig,
  rawMessage: Buffer,
): Promise<string | null> {
  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow(imapClientOptions(config));
    await client.connect();

    // Prefer the server-declared \Sent special-use folder; fall back to a
    // known-name probe if the server doesn't advertise one.
    let sentPath: string | null = null;
    for (const mailbox of await client.list()) {
      if (mailbox.specialUse === "\\Sent") {
        sentPath = mailbox.path;
        break;
      }
    }
    if (!sentPath) {
      const known = new Set((await client.list()).map((m) => m.path));
      sentPath = SENT_MAILBOX_CANDIDATES.find((name) => known.has(name)) ?? null;
    }
    if (!sentPath) {
      console.warn("[appendToSent] no Sent folder found; skipping append");
      return null;
    }

    // Mark as \Seen so it doesn't show up as an unread "incoming" message.
    await client.append(sentPath, rawMessage, ["\\Seen"]);
    return sentPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[appendToSent] failed to append to Sent folder:", message);
    return null;
  } finally {
    if (client) await client.logout().catch(() => undefined);
  }
}
