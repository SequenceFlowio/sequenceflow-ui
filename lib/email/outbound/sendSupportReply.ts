import { getResendClient } from "@/lib/email/outbound/resendClient";

export async function sendSupportReply(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const resend = getResendClient();
  const result = await resend.emails.send({
    from: input.from,
    to: [input.to],
    subject: input.subject,
    text: input.body,
    headers: {
      ...(input.inReplyTo ? { "In-Reply-To": input.inReplyTo } : {}),
      ...(input.references ? { References: input.references } : {}),
    },
  });

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Failed to send support reply.");
  }

  return result.data;
}
