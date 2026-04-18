import { sendEmail } from "@/lib/resend";

export async function sendSupportReply(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const result = await sendEmail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.body,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined,
  });

  return { id: result.id ?? crypto.randomUUID() };
}
