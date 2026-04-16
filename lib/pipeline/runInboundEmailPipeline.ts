import crypto from "crypto";

import { getOpenAIClient } from "@/lib/openaiClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantRuntime } from "@/lib/tenants/loadTenantRuntime";
import { retrieveKnowledgeContext } from "@/lib/knowledge/retrieveKnowledgeContext";
import { buildDecisionSystemPrompt, buildDecisionUserPrompt } from "@/lib/ai/decision/buildDecisionPrompt";
import { extractJsonObject, validateDecision } from "@/lib/ai/decision/validateDecision";
import { translateForUi } from "@/lib/ai/translation/translateForUi";
import { filterInboundEmail } from "@/lib/email/inbound/filterInboundEmail";
import { appendConfiguredSignature } from "@/lib/email/signature";
import { normalizeLanguage } from "@/lib/language/normalizeLanguage";
import type { NormalizedInboundEmail } from "@/types/aiInbox";

export async function runInboundEmailPipeline(input: {
  tenantId: string;
  email: NormalizedInboundEmail;
  conversationId?: string;
}) {
  const supabase = getSupabaseAdmin();
  const runtime = await loadTenantRuntime(input.tenantId);
  const filterResult = filterInboundEmail(input.email, runtime.channel.outboundFromEmail);

  const inboundTranslationSubject = await translateForUi({
    tenantId: input.tenantId,
    text: input.email.subject,
    contextType: "subject",
  });
  const inboundTranslationBody = await translateForUi({
    tenantId: input.tenantId,
    text: input.email.text,
    sourceLanguage: inboundTranslationSubject.sourceLanguage,
    contextType: "customer_message",
  });
  const detectedCustomerLanguage =
    normalizeLanguage(inboundTranslationBody.sourceLanguage) ??
    normalizeLanguage(inboundTranslationSubject.sourceLanguage);
  const fallbackReplyLanguage = normalizeLanguage(runtime.config.languageDefault) ?? "nl";
  const preferredReplyLanguage = detectedCustomerLanguage ?? fallbackReplyLanguage;

  const conversationId = input.conversationId ?? crypto.randomUUID();
  if (!input.conversationId) {
    await supabase.from("support_conversations").insert({
      id: conversationId,
      tenant_id: input.tenantId,
      status: filterResult.allowed ? "review" : "ignored",
      customer_email: input.email.from.email,
      customer_name: input.email.from.name ?? null,
      subject_original: input.email.subject,
      subject_english: inboundTranslationSubject.translatedText,
      latest_message_at: input.email.receivedAt,
    });
  }

  const { data: inboundMessage } = await supabase
    .from("support_messages")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: conversationId,
      direction: "inbound",
      provider: input.email.provider,
      provider_message_id: input.email.providerMessageId,
      internet_message_id: input.email.internetMessageId,
      in_reply_to: input.email.inReplyTo,
      message_references: input.email.references,
      from_email: input.email.from.email,
      from_name: input.email.from.name ?? null,
      to_email: input.email.recipient,
      cc_emails: input.email.cc,
      bcc_emails: input.email.bcc,
      subject_original: input.email.subject,
      body_original: input.email.text,
      language_original: detectedCustomerLanguage ?? inboundTranslationBody.sourceLanguage,
      subject_english: inboundTranslationSubject.translatedText,
      body_english: inboundTranslationBody.translatedText,
      translation_status: preferredReplyLanguage === "en" ? "not_needed" : "done",
      metadata: { headers: input.email.headers },
      received_at: input.email.receivedAt,
    })
    .select("id")
    .single();

  await supabase
    .from("support_conversations")
    .update({
      latest_inbound_message_id: inboundMessage?.id ?? null,
      latest_message_at: input.email.receivedAt,
      updated_at: new Date().toISOString(),
      status: filterResult.allowed ? "review" : "ignored",
      customer_email: input.email.from.email,
      customer_name: input.email.from.name ?? null,
      subject_original: input.email.subject,
      subject_english: inboundTranslationSubject.translatedText,
    })
    .eq("id", conversationId);

  if (!filterResult.allowed) {
    const { data: ignoredDecision } = await supabase
      .from("support_decisions")
      .insert({
        tenant_id: input.tenantId,
        conversation_id: conversationId,
        source_message_id: inboundMessage?.id ?? null,
        intent: "fallback",
        confidence: 0.99,
        decision: "ignore",
        requires_human: false,
        reasons: [filterResult.reason],
        actions: [],
        draft_subject_original: input.email.subject,
        draft_body_original: "",
        draft_language: preferredReplyLanguage,
        draft_subject_english: inboundTranslationSubject.translatedText,
        draft_body_english: "",
        translation_status: preferredReplyLanguage === "en" ? "not_needed" : "done",
        review_status: "ignored",
        model: "system",
        prompt_version: "v2",
      })
      .select("id")
      .single();

    await supabase
      .from("support_conversations")
      .update({
        latest_decision_id: ignoredDecision?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    await supabase.from("support_events").insert({
      tenant_id: input.tenantId,
      request_id: input.email.providerMessageId,
      source: "resend",
      subject: input.email.subject.slice(0, 120),
      intent: "fallback",
      confidence: 0.99,
      latency_ms: 0,
      draft_text: null,
      outcome: "ignored",
    });

    return { conversationId, decisionId: ignoredDecision?.id ?? null, status: "ignored" as const };
  }

  const knowledge = await retrieveKnowledgeContext(
    input.tenantId,
    `${input.email.subject}\n\n${input.email.text}`
  );

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: buildDecisionSystemPrompt(runtime, knowledge.context),
      },
      {
        role: "user",
        content: buildDecisionUserPrompt({
          subject: input.email.subject,
          body: input.email.text,
          customerEmail: input.email.from.email,
          customerName: input.email.from.name ?? null,
          receivedAt: input.email.receivedAt,
          detectedCustomerLanguage,
          fallbackReplyLanguage,
        }),
      },
    ],
    max_completion_tokens: 700,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
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
  const signedDraftBody = appendConfiguredSignature(decision.draft.body, runtime.config.signature);

  const translatedDraftSubject = await translateForUi({
    tenantId: input.tenantId,
    text: decision.draft.subject,
    sourceLanguage: decision.draft.language,
    contextType: "subject",
  });
  const translatedDraftBody = await translateForUi({
    tenantId: input.tenantId,
    text: signedDraftBody,
    sourceLanguage: decision.draft.language,
    contextType: "draft",
  });

  const reviewStatus =
    decision.decision === "ignore"
      ? "ignored"
      : decision.requires_human || decision.confidence < 0.8
        ? "pending_review"
        : "approved";

  const { data: savedDecision } = await supabase
    .from("support_decisions")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: conversationId,
      source_message_id: inboundMessage?.id ?? null,
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
      translation_status: decision.draft.language === "en" ? "not_needed" : "done",
      review_status: reviewStatus,
      model: "gpt-4.1-mini",
      prompt_version: "v2",
    })
    .select("id")
    .single();

  const conversationStatus =
    decision.decision === "ignore"
      ? "ignored"
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
    .eq("id", conversationId);

  await supabase.from("support_events").insert({
    tenant_id: input.tenantId,
    request_id: input.email.providerMessageId,
    source: "resend",
    subject: input.email.subject.slice(0, 120),
    intent: decision.intent,
    confidence: decision.confidence,
    latency_ms: 0,
    draft_text: signedDraftBody,
    outcome: reviewStatus === "approved" ? "auto_candidate" : "human_review",
  });

  return {
    conversationId,
    decisionId: savedDecision?.id ?? null,
    status: conversationStatus as "review" | "ignored" | "autosend_queued",
  };
}
