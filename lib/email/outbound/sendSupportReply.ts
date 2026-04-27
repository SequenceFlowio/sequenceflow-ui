import { sendTenantEmail } from "@/lib/email/outbound/mailer";

export async function sendSupportReply(input: {
  tenantId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  replyTo?: string | null;
  /** Stable RFC-822 Message-ID for threading inbound replies back to us. */
  messageId?: string | null;
}) {
  const result = await sendTenantEmail({
    tenantId: input.tenantId,
    to: input.to,
    subject: input.subject,
    text: input.body,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined,
    replyTo: input.replyTo ?? undefined,
    messageId: input.messageId ?? undefined,
  });

  return {
    id: result.id ?? crypto.randomUUID(),
    provider: result.provider,
    fromEmail: result.fromEmail,
    fromName: result.fromName,
  };
}
