import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantRuntime } from "@/lib/tenants/loadTenantRuntime";
import { translateForUi } from "@/lib/ai/translation/translateForUi";
import { sendSupportReply } from "@/lib/email/outbound/sendSupportReply";

export const runtime = "nodejs";

function formatFrom(name: string | null, email: string) {
  return name ? `${name} <${email}>` : email;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const runtime = await loadTenantRuntime(tenantId);

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, tenant_id, customer_email, latest_decision_id, latest_inbound_message_id")
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

  const finalDraftBody = draftBody || decision.draft_body_original;
  const finalDraftEnglish = await translateForUi({
    tenantId,
    text: finalDraftBody,
    sourceLanguage: decision.draft_language,
    contextType: "draft",
  });

  const sendResult = await sendSupportReply({
    from: formatFrom(runtime.channel.outboundFromName, runtime.channel.outboundFromEmail),
    to: conversation.customer_email,
    subject: decision.draft_subject_original,
    body: finalDraftBody,
    inReplyTo: inboundMessage.internet_message_id,
    references: inboundMessage.message_references || inboundMessage.internet_message_id,
  });

  await supabase.from("support_messages").insert({
    tenant_id: tenantId,
    conversation_id: conversation.id,
    direction: "outbound",
    provider: "resend",
    provider_message_id: sendResult.id,
    in_reply_to: inboundMessage.internet_message_id,
    message_references: inboundMessage.message_references || inboundMessage.internet_message_id,
    from_email: runtime.channel.outboundFromEmail,
    from_name: runtime.channel.outboundFromName,
    to_email: conversation.customer_email,
    subject_original: decision.draft_subject_original,
    body_original: finalDraftBody,
    language_original: decision.draft_language,
    subject_english: decision.draft_subject_english,
    body_english: finalDraftEnglish.translatedText,
    translation_status: decision.draft_language === "en" ? "not_needed" : "done",
    sent_at: new Date().toISOString(),
  });

  await Promise.all([
    supabase
      .from("support_decisions")
      .update({
        draft_body_original: finalDraftBody,
        draft_body_english: finalDraftEnglish.translatedText,
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
      source: "resend",
      subject: decision.draft_subject_original.slice(0, 120),
      intent: decision.intent,
      confidence: decision.confidence,
      latency_ms: 0,
      draft_text: finalDraftBody,
      outcome: "manual_send",
    }),
  ]);

  return NextResponse.json({ ok: true, messageId: sendResult.id });
}
