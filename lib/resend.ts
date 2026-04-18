/**
 * Resend email sending utility.
 * Used for all outbound email: replies, escalations, auto-send.
 *
 * Env vars required:
 *   RESEND_API_KEY          — your Resend API key
 *   RESEND_DEFAULT_FROM     — default from address (e.g. reply@inbox.emailreply.sequenceflow.io)
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
  process.env.RESEND_DEFAULT_FROM?.trim() ||
  `reply@${(process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.emailreply.sequenceflow.io").trim()}`;

function parseFromAddress(input: string) {
  const trimmed = input.trim();
  const bracketMatch = trimmed.match(/^(.*)<([^>]+)>$/);
  if (bracketMatch) {
    const name = bracketMatch[1].trim().replace(/^"+|"+$/g, "");
    const email = bracketMatch[2].trim();
    return { name: name || null, email };
  }

  return { name: null, email: trimmed };
}

function formatFromAddress(name: string | null, email: string) {
  return name ? `${name} <${email}>` : email;
}

function normalizeSenderEmail(senderEmail?: string | null) {
  const trimmed = senderEmail?.trim();
  if (!trimmed) return DEFAULT_FROM_EMAIL;

  const lower = trimmed.toLowerCase();
  if (lower.endsWith("@emailreply.sequenceflow.io")) {
    const localPart = trimmed.split("@")[0] || "reply";
    return `${localPart}@${(process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.emailreply.sequenceflow.io").trim()}`;
  }

  return trimmed;
}

function isUnverifiedDomainError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("domain is not verified") ||
    lower.includes("add and verify your domain") ||
    lower.includes("verify your domain")
  );
}

async function performSend(client: Resend, payload: Parameters<Resend["emails"]["send"]>[0]) {
  const result = await client.emails.send(payload);
  const { error } = result;
  if (error) {
    throw new Error((error as any).message ?? JSON.stringify(error));
  }
  return result.data;
}

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

export async function sendEmail(opts: SendEmailOptions): Promise<{ id?: string | null }> {
  const client = getClient();

  const requestedFrom = opts.from ?? DEFAULT_FROM_EMAIL;
  const parsedFrom = parseFromAddress(requestedFrom);
  const normalizedFromAddress = formatFromAddress(parsedFrom.name, normalizeSenderEmail(parsedFrom.email));

  const additionalHeaders: Record<string, string> = {};
  if (opts.inReplyTo)  additionalHeaders["In-Reply-To"] = opts.inReplyTo;
  if (opts.references) additionalHeaders["References"]  = opts.references;

  const basePayload = {
    from: normalizedFromAddress,
    to: [opts.to],
    subject: opts.subject,
    text: opts.text,
    ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    headers: Object.keys(additionalHeaders).length > 0 ? additionalHeaders : undefined,
  };

  try {
    const data = await performSend(client, basePayload);
    return { id: data?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallbackEmail = DEFAULT_FROM_EMAIL;
    const originalEmail = parsedFrom.email.trim();
    const shouldRetry =
      isUnverifiedDomainError(message) &&
      originalEmail &&
      originalEmail.toLowerCase() !== fallbackEmail.toLowerCase();

    if (!shouldRetry) {
      throw new Error(`Resend send failed: ${message}`);
    }

    const fallbackPayload = {
      ...basePayload,
      from: formatFromAddress(parsedFrom.name, fallbackEmail),
      ...(opts.replyTo
        ? {}
        : originalEmail
            ? { reply_to: originalEmail }
            : {}),
    };

    try {
      const data = await performSend(client, fallbackPayload);
      return { id: data?.id ?? null };
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Resend send failed: ${fallbackMessage}`);
    }
  }
}

/**
 * Build a "from" string for a tenant using their configured sender name/email.
 * Falls back to the default from address.
 */
export function buildFromAddress(senderName?: string | null, senderEmail?: string | null): string {
  const email = normalizeSenderEmail(senderEmail);
  const name  = senderName?.trim();
  return name ? `${name} <${email}>` : email;
}

export { normalizeSenderEmail };
