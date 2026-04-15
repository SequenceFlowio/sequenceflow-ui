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

function extractEmail(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

function extractName(raw: string) {
  const match = raw.match(/^(.+?)\s*<[^>]+>$/);
  return match?.[1]?.trim() || null;
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
    from: {
      email: extractEmail(event.data.from),
      name: extractName(event.data.from),
    },
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
