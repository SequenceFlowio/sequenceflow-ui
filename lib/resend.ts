/**
 * Resend email sending utility.
 * Used for all outbound email: replies, escalations, auto-send.
 *
 * Env vars required:
 *   RESEND_API_KEY          — your Resend API key
 *   RESEND_DEFAULT_FROM     — default from address (e.g. reply@emailreply.sequenceflow.io)
 */

import { Resend } from "resend";

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY env var is not set");
    _client = new Resend(key);
  }
  return _client;
}

export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_DEFAULT_FROM ?? "reply@emailreply.sequenceflow.io";

export interface SendEmailOptions {
  to:          string;
  subject:     string;
  text:        string;
  /** e.g. "Customer Support <reply@emailreply.sequenceflow.io>" */
  from?:       string;
  /** Message-ID of the email being replied to */
  inReplyTo?:  string;
  /** Full References header chain */
  references?: string;
  /** Reply-To address (useful for custom sender domains not yet verified) */
  replyTo?:    string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const client = getClient();

  const fromAddress = opts.from ?? DEFAULT_FROM_EMAIL;

  const additionalHeaders: Record<string, string> = {};
  if (opts.inReplyTo)  additionalHeaders["In-Reply-To"] = opts.inReplyTo;
  if (opts.references) additionalHeaders["References"]  = opts.references;

  const { error } = await client.emails.send({
    from:    fromAddress,
    to:      [opts.to],
    subject: opts.subject,
    text:    opts.text,
    ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    headers: Object.keys(additionalHeaders).length > 0 ? additionalHeaders : undefined,
  });

  if (error) {
    throw new Error(`Resend send failed: ${(error as any).message ?? JSON.stringify(error)}`);
  }
}

/**
 * Build a "from" string for a tenant using their configured sender name/email.
 * Falls back to the default from address.
 */
export function buildFromAddress(senderName?: string | null, senderEmail?: string | null): string {
  const email = senderEmail?.trim() || DEFAULT_FROM_EMAIL;
  const name  = senderName?.trim();
  return name ? `${name} <${email}>` : email;
}
