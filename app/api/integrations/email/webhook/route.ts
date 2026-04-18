import { NextResponse } from "next/server";

import { verifyResendWebhook } from "@/lib/email/inbound/verifyResendWebhook";
import { getResendClient } from "@/lib/email/outbound/resendClient";
import { normalizeResendInbound } from "@/lib/email/inbound/normalizeResendInbound";
import { resolveTenantFromAddress } from "@/lib/email/inbound/resolveTenantFromAddress";
import { runInboundEmailPipeline } from "@/lib/pipeline/runInboundEmailPipeline";
import { handleGmailForwardingVerification } from "@/lib/email/inbound/handleGmailForwardingVerification";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { event } = await verifyResendWebhook(req);

    if (event.type !== "email.received") {
      return NextResponse.json({ ok: true, ignored: true, type: event.type });
    }

    const resend = getResendClient();
    const inbound = await resend.emails.receiving.get(event.data.email_id);
    if (inbound.error || !inbound.data) {
      return NextResponse.json(
        { error: inbound.error?.message ?? "Failed to load inbound email from Resend." },
        { status: 502 }
      );
    }

    const normalized = normalizeResendInbound(event, inbound.data);

    const isVerification = await handleGmailForwardingVerification(normalized);
    if (isVerification) {
      return NextResponse.json({ ok: true, ignored: true, reason: "gmail_forwarding_verification" });
    }

    const tenantId = await resolveTenantFromAddress(normalized.recipient);
    const result = await runInboundEmailPipeline({ tenantId, email: normalized });

    return NextResponse.json({ ok: true, tenantId, ...result });
  } catch (error: unknown) {
    console.error("[email/webhook]", error);
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
