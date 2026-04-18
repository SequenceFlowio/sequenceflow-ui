import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOpenAIClient } from "@/lib/openaiClient";
import { loadTenantRuntime } from "@/lib/tenants/loadTenantRuntime";
import { retrieveKnowledgeContext } from "@/lib/knowledge/retrieveKnowledgeContext";
import { buildDecisionSystemPrompt, buildDecisionUserPrompt } from "@/lib/ai/decision/buildDecisionPrompt";
import { extractJsonObject, validateDecision } from "@/lib/ai/decision/validateDecision";
import { translateForUi } from "@/lib/ai/translation/translateForUi";
import { appendConfiguredSignature } from "@/lib/email/signature";
import { normalizeLanguage } from "@/lib/language/normalizeLanguage";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const supabase = getSupabaseAdmin();

  // Load the conversation and its latest inbound message
  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, latest_inbound_message_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Prefer latest_inbound_message_id, but fall back to querying messages directly
  const messageQuery = conversation.latest_inbound_message_id
    ? supabase.from("support_messages").select("*").eq("id", conversation.latest_inbound_message_id).single()
    : supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .eq("tenant_id", tenantId)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

  const { data: message } = await messageQuery;

  if (!message) {
    return NextResponse.json({ error: "No inbound message found for this conversation" }, { status: 404 });
  }

  // Re-run only the AI decision — do NOT insert a new inbound message
  const tenantRuntime = await loadTenantRuntime(tenantId);
  const fallbackReplyLanguage = normalizeLanguage(tenantRuntime.config.languageDefault) ?? "nl";
  const detectedCustomerLanguage = normalizeLanguage(message.language_original) ?? null;
  const preferredReplyLanguage = detectedCustomerLanguage ?? fallbackReplyLanguage;

  try {
    const knowledge = await retrieveKnowledgeContext(
      tenantId,
      `${message.subject_original}\n\n${message.body_original ?? ""}`
    );

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildDecisionSystemPrompt(tenantRuntime, knowledge.context),
        },
        {
          role: "user",
          content: buildDecisionUserPrompt({
            subject: message.subject_original,
            body: message.body_original ?? "",
            customerEmail: message.from_email,
            customerName: message.from_name ?? null,
            receivedAt: message.received_at ?? message.created_at,
            detectedCustomerLanguage,
            fallbackReplyLanguage,
          }),
        },
      ],
      max_completion_tokens: 900,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    console.log("[regenerate] raw AI response:", raw.slice(0, 300));
    const rawDecision = validateDecision(extractJsonObject(raw));
    const decision = {
      ...rawDecision,
      draft: {
        ...rawDecision.draft,
        language:
          detectedCustomerLanguage ??
          normalizeLanguage(rawDecision.draft.language) ??
          fallbackReplyLanguage,
      },
    };
    const signedDraftBody = appendConfiguredSignature(decision.draft.body, tenantRuntime.config.signature);

    const [translatedDraftSubject, translatedDraftBody] = await Promise.all([
      translateForUi({ tenantId, text: decision.draft.subject, sourceLanguage: decision.draft.language, contextType: "subject" }),
      translateForUi({ tenantId, text: signedDraftBody, sourceLanguage: decision.draft.language, contextType: "draft" }),
    ]);

    const reviewStatus =
      decision.decision === "ignore"
        ? "ignored"
        : decision.requires_human || decision.confidence < 0.8
          ? "pending_review"
          : "approved";

    const { data: savedDecision } = await supabase
      .from("support_decisions")
      .insert({
        tenant_id: tenantId,
        conversation_id: conversation.id,
        source_message_id: conversation.latest_inbound_message_id,
        intent: decision.intent,
        confidence: decision.confidence,
        decision: decision.decision,
        requires_human: decision.requires_human,
        reasons: decision.reasons,
        actions: decision.actions,
        draft_subject_original: decision.draft.subject,
        draft_body_original: signedDraftBody,
        draft_language: decision.draft.language,
        draft_subject_english: translatedDraftSubject.translatedText,
        draft_body_english: translatedDraftBody.translatedText,
        translation_status: preferredReplyLanguage === "en" ? "not_needed" : "done",
        review_status: reviewStatus,
        model: "gpt-4.1-mini",
        prompt_version: "v2",
      })
      .select("id")
      .single();

    const conversationStatus =
      decision.decision === "ignore"
        ? "ignored"
        : reviewStatus === "approved" &&
          tenantRuntime.config.autosendEnabled &&
          decision.confidence >= tenantRuntime.config.autosendThreshold
          ? "pending_autosend"
          : reviewStatus === "approved"
            ? "open"
            : "review";

    await supabase
      .from("support_conversations")
      .update({
        latest_decision_id: savedDecision?.id ?? null,
        status: conversationStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);

    return NextResponse.json({ ok: true, decisionId: savedDecision?.id ?? null, status: conversationStatus });
  } catch (aiError) {
    console.error("[regenerate] AI step failed:", aiError);
    const errorMessage = aiError instanceof Error ? aiError.message : "AI generation failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
