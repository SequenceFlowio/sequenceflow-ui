import { sendTenantEmail } from "@/lib/email/outbound/mailer";

export async function sendEscalationEmail(input: {
  tenantId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}) {
  const result = await sendTenantEmail({
    tenantId: input.tenantId,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });
  return { id: result.id ?? crypto.randomUUID(), provider: result.provider };
}
