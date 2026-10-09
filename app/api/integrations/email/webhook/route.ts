import { NextResponse } from "next/server";

import { verifyResendWebhook } from "@/lib/email/inbound/verifyResendWebhook";
import { getResendClient } from "@/lib/email/outbound/resendClient";
import { normalizeResendInbound } from "@/lib/email/inbound/normalizeResendInbound";
import { resolveTenantFromAddress } from "@/lib/email/inbound/resolveTenantFromAddress";
import { findExistingConversation } from "@/lib/email/inbound/findExistingConversation";
import { runInboundEmailPipeline } from "@/lib/pipeline/runInboundEmailPipeline";
import { handleGmailForwardingVerification, markForwardingWorking } from "@/lib/email/inbound/handleGmailForwardingVerification";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // A bad signature is not ours to retry; answer 401 instead of a 500.
    let event: Awaited<ReturnType<typeof verifyResendWebhook>>["event"];
    try {
      ({ event } = await verifyResendWebhook(req));
    } catch (error) {
      console.warn("[email/webhook] signature check failed:", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

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

    // Mail to an address that belongs to no workspace will never succeed;
    // acknowledging it keeps Resend from retrying and disabling the webhook.
    let tenantId: string;
    try {
      tenantId = await resolveTenantFromAddress(normalized.recipient);
    } catch {
      console.warn("[email/webhook] no workspace for this recipient; ignored.");
      return NextResponse.json({ ok: true, ignored: true, reason: "unknown_recipient" });
    }
    // Mail reached this workspace's forwarding address: forwarding demonstrably works.
    await markForwardingWorking(tenantId);

    // Thread-match replies onto their existing conversation so the customer's
    // follow-ups show up in the same ticket instead of creating orphan tickets.
    const existingConversationId = await findExistingConversation({
      tenantId,
      inReplyTo: normalized.inReplyTo,
      references: normalized.references,
    });

    const result = await runInboundEmailPipeline({
      tenantId,
      email: normalized,
      conversationId: existingConversationId ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      tenantId,
      threaded: Boolean(existingConversationId),
      ...result,
    });
  } catch (error: unknown) {
    console.error("[email/webhook]", error);
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
