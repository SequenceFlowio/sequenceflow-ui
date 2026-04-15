import { getResendClient } from "@/lib/email/outbound/resendClient";

export async function sendEscalationEmail(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  const resend = getResendClient();
  const result = await resend.emails.send({
    from: input.from,
    to: [input.to],
    subject: input.subject,
    text: input.body,
  });

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Failed to send escalation email.");
  }

  return result.data;
}
