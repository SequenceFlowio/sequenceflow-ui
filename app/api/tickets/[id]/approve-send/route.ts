import { NextResponse } from "next/server";

import { translateForUi } from "@/lib/ai/translation/translateForUi";
import { sendSupportReply } from "@/lib/email/outbound/sendSupportReply";
import { buildOutboundMessageId } from "@/lib/email/outbound/messageId";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantRuntime } from "@/lib/tenants/loadTenantRuntime";

export const runtime = "nodejs";

function formatFrom(name: string | null, email: string) {
  return name ? `${name} <${email}>` : email;
}

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

    let draftBody = "";
    try {
      const body = await req.json();
      draftBody = String(body.draftBody ?? "").trim();
    } catch {
      draftBody = "";
    }

    const supabase = getSupabaseAdmin();
    const runtimeConfig = await loadTenantRuntime(tenantId);

    const { data: conversation } = await supabase
      .from("support_conversations")
      .select("id, tenant_id, customer_email, subject_original, latest_decision_id, latest_inbound_message_id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!conversation?.latest_decision_id || !conversation.latest_inbound_message_id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const [{ data: decision }, { data: inboundMessage }] = await Promise.all([
      supabase
        .from("support_decisions")
        .select("*")
        .eq("id", conversation.latest_decision_id)
        .single(),
      supabase
        .from("support_messages")
        .select("*")
        .eq("id", conversation.latest_inbound_message_id)
        .single(),
    ]);

    if (!decision || !inboundMessage) {
      return NextResponse.json({ error: "Conversation context is incomplete." }, { status: 404 });
    }

    const finalDraftBody = (draftBody || decision.draft_body_original || "").trim();
    if (!finalDraftBody) {
      return NextResponse.json({ error: "Draft body is empty." }, { status: 400 });
    }

    // Safety guard: never send replies to our own inbound routing domain.
    // If customer_email points at our own inbox, a normalization bug has stored
    // the forwarding envelope instead of the real customer. Fail loudly instead
    // of silently looping mail back to ourselves.
    const INBOUND_DOMAIN = "inbox.emailreply.sequenceflow.io";
    const customerEmail = String(conversation.customer_email ?? "").toLowerCase();
    if (!customerEmail || customerEmail.endsWith(`@${INBOUND_DOMAIN}`)) {
      return NextResponse.json(
        {
          error:
            "Refusing to send: the stored customer address points at our own inbound domain. The original sender could not be resolved from the inbound email headers.",
          customerEmail,
        },
        { status: 422 },
      );
    }

    const finalSubjectOriginal = decision.draft_subject_original || conversation.subject_original || "Re:";
    const finalSubjectEnglish = decision.draft_subject_english || finalSubjectOriginal;

    let finalDraftEnglish = decision.draft_body_english || "";
    if (decision.draft_language === "en") {
      finalDraftEnglish = finalDraftBody;
    } else if (finalDraftBody !== decision.draft_body_original || !finalDraftEnglish) {
      try {
        const translated = await translateForUi({
          tenantId,
          text: finalDraftBody,
          sourceLanguage: decision.draft_language,
          contextType: "draft",
        });
        finalDraftEnglish = translated.translatedText;
      } catch (translationError) {
        console.error("[approve-send/translate]", translationError);
        finalDraftEnglish = decision.draft_body_english || finalDraftBody;
      }
    }

    // Generate our own Message-ID so the customer's reply threads back to us.
    const outboundMessageId = buildOutboundMessageId(runtimeConfig.channel.outboundFromEmail);

    const sendResult = await sendSupportReply({
      tenantId,
      from: formatFrom(runtimeConfig.channel.outboundFromName, runtimeConfig.channel.outboundFromEmail),
      to: conversation.customer_email,
      subject: finalSubjectOriginal,
      body: finalDraftBody,
      inReplyTo: inboundMessage.internet_message_id,
      references: inboundMessage.message_references || inboundMessage.internet_message_id,
      replyTo: runtimeConfig.channel.inboundAddress,
      messageId: outboundMessageId,
    });

    await supabase.from("support_messages").insert({
      tenant_id: tenantId,
      conversation_id: conversation.id,
      direction: "outbound",
      provider: sendResult.provider,
      provider_message_id: sendResult.id,
      internet_message_id: outboundMessageId,
      in_reply_to: inboundMessage.internet_message_id,
      message_references: inboundMessage.message_references || inboundMessage.internet_message_id,
      from_email: sendResult.fromEmail || runtimeConfig.channel.outboundFromEmail,
      from_name: sendResult.fromName ?? runtimeConfig.channel.outboundFromName,
      to_email: conversation.customer_email,
      subject_original: finalSubjectOriginal,
      body_original: finalDraftBody,
      language_original: decision.draft_language,
      subject_english: finalSubjectEnglish,
      body_english: finalDraftEnglish,
      translation_status: decision.draft_language === "en" ? "not_needed" : "done",
      sent_at: new Date().toISOString(),
    });

    await Promise.all([
      supabase
        .from("support_decisions")
        .update({
          draft_body_original: finalDraftBody,
          draft_body_english: finalDraftEnglish,
          review_status: "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", decision.id),
      supabase
        .from("support_conversations")
        .update({
          status: "sent",
          latest_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id),
      supabase.from("support_events").insert({
        tenant_id: tenantId,
        request_id: sendResult.id,
        source: sendResult.provider,
        subject: finalSubjectOriginal.slice(0, 120),
        intent: decision.intent,
        confidence: decision.confidence,
        latency_ms: 0,
        draft_text: finalDraftBody,
        outcome: "manual_send",
      }),
    ]);

    return NextResponse.json({ ok: true, messageId: sendResult.id });
  } catch (err: unknown) {
    console.error("[approve-send]", err);
    const message = err instanceof Error ? err.message : "Failed to send support reply.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
