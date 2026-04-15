import { Resend } from "resend";

import type { WebhookEventPayload } from "resend";

export async function verifyResendWebhook(req: Request): Promise<{
  event: WebhookEventPayload;
  rawBody: string;
}> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (!webhookSecret) {
    return {
      event: JSON.parse(rawBody) as WebhookEventPayload,
      rawBody,
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const event = resend.webhooks.verify({
    payload: rawBody,
    webhookSecret,
    headers: {
      id: req.headers.get("svix-id") ?? "",
      timestamp: req.headers.get("svix-timestamp") ?? "",
      signature: req.headers.get("svix-signature") ?? "",
    },
  });

  return { event, rawBody };
}
