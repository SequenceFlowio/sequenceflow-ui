import type { WebhookEventPayload } from "resend";

import type { NormalizedInboundEmail } from "@/types/aiInbox";

type ResendReceivedEmail = {
  text: string | null;
  html: string | null;
  headers: Record<string, string> | Array<{ name: string; value: string }> | null;
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
 *   2. `Reply-To:` header (rare, but useful fallback)
 *   3. Resend `event.data.from` envelope (last resort)
 */
function resolveOriginalSender(
  headers: Record<string, string>,
  envelopeFrom: string,
): { email: string; name: string | null } {
  const fromHeader = headerValue(headers, "from");
  if (fromHeader && fromHeader.trim()) {
    return { email: extractEmail(fromHeader), name: extractName(fromHeader) };
  }
  const replyTo = headerValue(headers, "reply-to");
  if (replyTo && replyTo.trim()) {
    return { email: extractEmail(replyTo), name: extractName(replyTo) };
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
  return {
    provider: "resend",
    providerMessageId: event.data.email_id,
    recipient,
    from: resolveOriginalSender(headers, event.data.from),
    to: event.data.to ?? [],
    cc: event.data.cc ?? [],
    bcc: event.data.bcc ?? [],
    subject: event.data.subject ?? "",
    text: String(email?.text ?? "").trim(),
    html: email?.html ?? null,
    headers,
    internetMessageId: event.data.message_id ?? headers["Message-Id"] ?? null,
    inReplyTo: headers["In-Reply-To"] ?? null,
    references: headers["References"] ?? null,
    receivedAt: event.data.created_at,
  };
}
