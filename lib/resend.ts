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

/**
 * Resolve the default from address, with a self-healing rewrite for the
 * common misconfiguration where `RESEND_DEFAULT_FROM` or `INBOUND_EMAIL_DOMAIN`
 * is set to the bare `emailreply.sequenceflow.io`. Only `inbox.emailreply.sequenceflow.io`
 * is verified at Resend; the bare domain is not. If the env vars ever
 * point at the bare domain, rewrite to the inbox subdomain so outbound
 * sends never fall back to an unverified address.
 */
function resolveDefaultFromEmail(): string {
  const VERIFIED_DOMAIN = "inbox.emailreply.sequenceflow.io";
  const raw =
    process.env.RESEND_DEFAULT_FROM?.trim() ||
    `reply@${(process.env.INBOUND_EMAIL_DOMAIN ?? VERIFIED_DOMAIN).trim()}`;
  // Rewrite bare `emailreply.sequenceflow.io` → `inbox.emailreply.sequenceflow.io`
  return raw.replace(/@emailreply\.sequenceflow\.io$/i, `@${VERIFIED_DOMAIN}`);
}

export const DEFAULT_FROM_EMAIL = resolveDefaultFromEmail();

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
  /**
   * RFC-822 `Message-ID` to set on the outgoing email (angle-bracketed).
   * Setting our own lets us thread the customer's reply back to the same
   * conversation via their `In-Reply-To` header.
   */
  messageId?:  string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id?: string | null }> {
  const client = getClient();

  const requestedFrom = opts.from ?? DEFAULT_FROM_EMAIL;
  const parsedFrom = parseFromAddress(requestedFrom);
  const normalizedFromAddress = formatFromAddress(parsedFrom.name, normalizeSenderEmail(parsedFrom.email));

  const additionalHeaders: Record<string, string> = {};
  if (opts.inReplyTo)  additionalHeaders["In-Reply-To"] = opts.inReplyTo;
  if (opts.references) additionalHeaders["References"]  = opts.references;
  if (opts.messageId)  additionalHeaders["Message-Id"]  = opts.messageId;

  const basePayload = {
    from: normalizedFromAddress,
    to: [opts.to],
    subject: opts.subject,
    text: opts.text,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
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
            ? { replyTo: originalEmail }
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
