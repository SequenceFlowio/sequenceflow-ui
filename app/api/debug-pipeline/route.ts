import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOpenAIClient } from "@/lib/openaiClient";
import { loadTenantRuntime } from "@/lib/tenants/loadTenantRuntime";
import { retrieveKnowledgeContext } from "@/lib/knowledge/retrieveKnowledgeContext";
import { buildDecisionSystemPrompt, buildDecisionUserPrompt } from "@/lib/ai/decision/buildDecisionPrompt";
import { extractJsonObject, validateDecision } from "@/lib/ai/decision/validateDecision";
import { appendConfiguredSignature } from "@/lib/email/signature";
import { normalizeLanguage } from "@/lib/language/normalizeLanguage";
import { translateForUi } from "@/lib/ai/translation/translateForUi";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("id");

  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!conversationId) {
    return NextResponse.json({ error: "Pass ?id=CONVERSATION_ID" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Load the inbound message
  const { data: message } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", tenantId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!message) {
    return NextResponse.json({ error: "No inbound message found", conversationId });
  }

  const diagnostics: Record<string, unknown> = {
    conversationId,
    messageId: message.id,
    subject: message.subject_original,
    bodyPreview: String(message.body_original ?? "").slice(0, 200),
    fromEmail: message.from_email,
    languageOriginal: message.language_original,
  };

  // Step 1: Load runtime
  let tenantRuntime;
  try {
    tenantRuntime = await loadTenantRuntime(tenantId);
    diagnostics.runtimeLoaded = true;
  } catch (e) {
    return NextResponse.json({ step: "loadTenantRuntime", error: String(e), diagnostics });
  }

  const fallbackReplyLanguage = normalizeLanguage(tenantRuntime.config.languageDefault) ?? "nl";
  const detectedCustomerLanguage = normalizeLanguage(message.language_original) ?? null;

  // Step 2: Knowledge
  let knowledge;
  try {
    knowledge = await retrieveKnowledgeContext(
      tenantId,
      `${message.subject_original}\n\n${message.body_original ?? ""}`
    );
    diagnostics.knowledgeChunks = knowledge.chunks;
  } catch (e) {
    return NextResponse.json({ step: "retrieveKnowledgeContext", error: String(e), diagnostics });
  }

  // Step 3: OpenAI call
  let rawResponse: string;
  let finishReason: string | undefined;
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: buildDecisionSystemPrompt(tenantRuntime, knowledge.context) },
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
    rawResponse = completion.choices[0]?.message?.content ?? "";
    finishReason = completion.choices[0]?.finish_reason;
    diagnostics.openaiRaw = rawResponse.slice(0, 800);
    diagnostics.finishReason = finishReason;
  } catch (e) {
    return NextResponse.json({ step: "openai", error: String(e), diagnostics });
  }

  // Step 4: Parse + validate
  let decision;
  try {
    const parsed = extractJsonObject(rawResponse);
    diagnostics.parsed = parsed;
    const rawDecision = validateDecision(parsed);
    decision = {
      ...rawDecision,
      draft: {
        ...rawDecision.draft,
        language: detectedCustomerLanguage ?? normalizeLanguage(rawDecision.draft.language) ?? fallbackReplyLanguage,
      },
    };
    diagnostics.decisionIntent = decision.intent;
    diagnostics.decisionDraftBodyLength = decision.draft.body.length;
  } catch (e) {
    return NextResponse.json({ step: "validateDecision", error: String(e), diagnostics });
  }

  // Step 5: Translate
  const signedDraftBody = appendConfiguredSignature(decision.draft.body, tenantRuntime.config.signature);
  let translatedSubject, translatedBody;
  try {
    [translatedSubject, translatedBody] = await Promise.all([
      translateForUi({ tenantId, text: decision.draft.subject, sourceLanguage: decision.draft.language, contextType: "subject" }),
      translateForUi({ tenantId, text: signedDraftBody, sourceLanguage: decision.draft.language, contextType: "draft" }),
    ]);
    diagnostics.translatedBodyLength = translatedBody.translatedText.length;
  } catch (e) {
    return NextResponse.json({ step: "translateForUi", error: String(e), diagnostics });
  }

  // Step 6: Save decision
  const reviewStatus = decision.decision === "ignore" ? "ignored"
    : decision.requires_human || decision.confidence < 0.8 ? "pending_review" : "approved";

  const { data: savedDecision, error: saveError } = await supabase
    .from("support_decisions")
    .insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      source_message_id: message.id,
      intent: decision.intent,
      confidence: decision.confidence,
      decision: decision.decision,
      requires_human: decision.requires_human,
      reasons: decision.reasons,
      actions: decision.actions,
      draft_subject_original: decision.draft.subject,
      draft_body_original: signedDraftBody,
      draft_language: decision.draft.language,
      draft_subject_english: translatedSubject.translatedText,
      draft_body_english: translatedBody.translatedText,
      translation_status: decision.draft.language === "en" ? "not_needed" : "done",
      review_status: reviewStatus,
      model: "gpt-4.1-mini",
      prompt_version: "v2",
    })
    .select("id")
    .single();

  if (saveError) {
    return NextResponse.json({ step: "saveDecision", error: saveError.message, diagnostics });
  }

  await supabase
    .from("support_conversations")
    .update({ latest_decision_id: savedDecision?.id, status: "review", updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json({
    success: true,
    decisionId: savedDecision?.id,
    draftBodyLength: signedDraftBody.length,
    draftBodyPreview: signedDraftBody.slice(0, 300),
    diagnostics,
  });
}
