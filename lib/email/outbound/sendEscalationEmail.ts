import { sendEmail } from "@/lib/resend";

export async function sendEscalationEmail(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  const result = await sendEmail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });
  return { id: result.id ?? crypto.randomUUID() };
}
