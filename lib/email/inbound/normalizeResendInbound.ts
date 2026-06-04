import type { WebhookEventPayload } from "resend";

import { extractVisibleReplyText } from "@/lib/email/inbound/replyText";
import type { NormalizedInboundAttachment, NormalizedInboundEmail } from "@/types/aiInbox";

type ResendReceivedEmail = {
  text: string | null;
  html: string | null;
  headers: Record<string, string> | Array<{ name: string; value: string }> | null;
  attachments?: unknown;
};

function headerMap(headers: Array<{ name: string; value: string }> | Record<string, string> | undefined) {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map((header) => [header.name, header.value]));
  }
  return headers;
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const lowerTarget = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerTarget) {
      return typeof value === "string" ? value : String(value ?? "");
    }
  }
  return undefined;
}

function extractEmail(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

function extractName(raw: string) {
  const match = raw.match(/^(.+?)\s*<[^>]+>$/);
  return match?.[1]?.trim().replace(/^"+|"+$/g, "") || null;
}

function extractEmails(raw: string | undefined) {
  if (!raw) return [];
  const matches = raw.match(/<([^>]+)>/g);
  if (matches) {
    return matches.map(extractEmail);
  }
  return raw
    .split(",")
    .map(extractEmail)
    .filter(Boolean);
}

function bufferFromUnknownContent(content: unknown): Buffer | null {
  if (Buffer.isBuffer(content)) return Buffer.from(content);
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (typeof content !== "string" || !content.trim()) return null;

  const value = content.trim();
  const base64Payload = value.startsWith("data:")
    ? value.split(",", 2)[1] ?? ""
    : value;
  try {
    return Buffer.from(base64Payload, "base64");
  } catch {
    return null;
  }
}

function normalizeResendAttachments(value: unknown): NormalizedInboundAttachment[] {
  if (!Array.isArray(value)) return [];

  const attachments: NormalizedInboundAttachment[] = [];
  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const content = bufferFromUnknownContent(item.content ?? item.data ?? item.body);
    if (!content || content.byteLength === 0) continue;

    attachments.push({
      filename:
        typeof item.filename === "string" && item.filename.trim()
          ? item.filename.trim()
          : `attachment-${index + 1}`,
      content,
      contentType:
        typeof item.content_type === "string"
          ? item.content_type
          : typeof item.contentType === "string"
            ? item.contentType
            : null,
      contentId:
        typeof item.content_id === "string"
          ? item.content_id
          : typeof item.contentId === "string"
            ? item.contentId
            : null,
    });
  }

  return attachments;
}

/**
 * Resolve the authoritative original sender of an inbound email.
 *
 * Resend's `event.data.from` reflects the *envelope* sender (SMTP MAIL FROM).
 * When an email is forwarded (e.g. Gmail → Resend inbound), that envelope
 * address is rewritten to the forwarder, not the real customer. The original
 * sender is only reliably found in the raw `From:` header.
 *
 * Priority:
 *   1. `From:` header from the raw email
 *   2. `Reply-To:` when the raw mail is a self-addressed form notification
 *   3. Resend `event.data.from` envelope (last resort)
 */
function resolveOriginalSender(
  headers: Record<string, string>,
  envelopeFrom: string,
): { email: string; name: string | null } {
  const fromHeader = headerValue(headers, "from");
  const replyTo = headerValue(headers, "reply-to");
  if (fromHeader && fromHeader.trim()) {
    const from = { email: extractEmail(fromHeader), name: extractName(fromHeader) };
    const replyToSender = replyTo?.trim()
      ? { email: extractEmail(replyTo), name: extractName(replyTo) }
      : null;
    const recipients = [
      ...extractEmails(headerValue(headers, "to")),
      ...extractEmails(headerValue(headers, "cc")),
      ...extractEmails(headerValue(headers, "bcc")),
    ];

    if (replyToSender && replyToSender.email !== from.email && recipients.includes(from.email)) {
      return replyToSender;
    }

    return from;
  }
  return { email: extractEmail(envelopeFrom), name: extractName(envelopeFrom) };
}

export function normalizeResendInbound(event: WebhookEventPayload, email: ResendReceivedEmail): NormalizedInboundEmail {
  if (event.type !== "email.received") {
    throw new Error(`Unsupported event type: ${event.type}`);
  }

  const recipient = event.data.to?.[0];
  if (!recipient) {
    throw new Error("Inbound email did not include a recipient.");
  }

  const headers = headerMap(email?.headers ?? undefined);
  const messageId = headerValue(headers, "message-id");
  const inReplyTo = headerValue(headers, "in-reply-to");
  const references = headerValue(headers, "references");
  const rawText = String(email?.text ?? "").trim();
  const visibleText = extractVisibleReplyText(rawText);

  return {
    provider: "resend",
    providerMessageId: event.data.email_id,
    recipient,
    from: resolveOriginalSender(headers, event.data.from),
    to: event.data.to ?? [],
    cc: event.data.cc ?? [],
    bcc: event.data.bcc ?? [],
    subject: event.data.subject ?? "",
    text: visibleText,
    html: email?.html ?? null,
    headers,
    internetMessageId: event.data.message_id ?? messageId ?? null,
    inReplyTo: inReplyTo ?? null,
    references: references ?? null,
    receivedAt: event.data.created_at,
    attachments: normalizeResendAttachments(email?.attachments),
  };
}
