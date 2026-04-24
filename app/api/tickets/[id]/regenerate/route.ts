import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { rerunConversationDecision } from "@/lib/pipeline/runInboundEmailPipeline";
import { extractVisibleReplyText } from "@/lib/email/inbound/replyText";
import type { NormalizedInboundEmail } from "@/types/aiInbox";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let tenantId: string;
    try {
      ({ tenantId } = await getTenantId(req));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Not authenticated";
      return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: conversation } = await supabase
      .from("support_conversations")
      .select("id, latest_inbound_message_id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const latestInboundMessageId = conversation.latest_inbound_message_id ??
      (
        await supabase
          .from("support_messages")
          .select("id")
          .eq("conversation_id", conversation.id)
          .eq("tenant_id", tenantId)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data?.id;

    if (!latestInboundMessageId) {
      return NextResponse.json({ error: "Conversation has no inbound message to regenerate from" }, { status: 404 });
    }

    const { data: message } = await supabase
      .from("support_messages")
      .select("*")
      .eq("id", latestInboundMessageId)
      .single();

    if (!message) {
      return NextResponse.json({ error: "No inbound message found for this conversation" }, { status: 404 });
    }

    const normalized: NormalizedInboundEmail = {
      provider: "resend",
      providerMessageId: message.provider_message_id || message.id,
      recipient: message.to_email,
      from: {
        email: message.from_email,
        name: message.from_name,
      },
      to: [message.to_email],
      cc: Array.isArray(message.cc_emails) ? message.cc_emails : [],
      bcc: Array.isArray(message.bcc_emails) ? message.bcc_emails : [],
      subject: message.subject_original,
      text: extractVisibleReplyText(message.body_original),
      html: null,
      headers:
        typeof message.metadata === "object" &&
        message.metadata !== null &&
        "headers" in message.metadata &&
        typeof message.metadata.headers === "object" &&
        message.metadata.headers !== null
          ? (message.metadata.headers as Record<string, string>)
          : {},
      internetMessageId: message.internet_message_id,
      inReplyTo: message.in_reply_to,
      references: message.message_references,
      receivedAt: message.received_at ?? message.created_at,
    };

    const result = await rerunConversationDecision({
      tenantId,
      conversationId: conversation.id,
      sourceMessageId: latestInboundMessageId,
      email: normalized,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error("[tickets/regenerate]", error);
    const message = error instanceof Error ? error.message : "Failed to regenerate decision.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
