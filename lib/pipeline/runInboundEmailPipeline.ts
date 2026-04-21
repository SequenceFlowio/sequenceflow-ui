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

type TranslationResult = Awaited<ReturnType<typeof translateForUi>>;
type PipelineRuntime = Awaited<ReturnType<typeof loadTenantRuntime>>;
type FilterResult = ReturnType<typeof filterInboundEmail>;

function buildReplySubject(subject: string) {
  const normalized = subject.trim();
  if (!normalized) return "Re:";
  return /^re:/i.test(normalized) ? normalized : `Re: ${normalized}`;
}

function buildFallbackDraftBody(language: string) {
  switch (language) {
    case "nl":
      return "Bedankt voor uw bericht. We hebben uw vraag ontvangen en komen hier zo snel mogelijk persoonlijk op terug.";
    case "de":
      return "Vielen Dank fur Ihre Nachricht. Wir haben Ihre Anfrage erhalten und melden uns so schnell wie moglich personlich bei Ihnen zuruck.";
    case "fr":
      return "Merci pour votre message. Nous avons bien recu votre demande et nous reviendrons vers vous personnellement des que possible.";
    case "es":
      return "Gracias por su mensaje. Hemos recibido su consulta y volveremos a responderle personalmente lo antes posible.";
    case "it":
      return "Grazie per il suo messaggio. Abbiamo ricevuto la sua richiesta e le risponderemo personalmente il prima possibile.";
    case "pt":
      return "Obrigado pela sua mensagem. Recebemos o seu pedido e responderemos pessoalmente o mais rapidamente possivel.";
    default:
      return "Thanks for your message. We have received your question and will get back to you personally as soon as possible.";
  }
}

function buildFallbackDecision(input: {
  subject: string;
  preferredReplyLanguage: string;
  reason: string;
}) {
  return {
    intent: "fallback",
    confidence: 0,
    decision: "ask_question" as const,
    requires_human: true,
    reasons: [`AI draft fallback used: ${input.reason}`],
    actions: [],
    draft: {
      subject: buildReplySubject(input.subject),
      body: buildFallbackDraftBody(input.preferredReplyLanguage),
      language: input.preferredReplyLanguage,
    },
  };
}

async function generateConversationDecision(input: {
  tenantId: string;
  email: NormalizedInboundEmail;
  conversationId: string;
  sourceMessageId?: string | null;
  runtime: PipelineRuntime;
  filterResult: FilterResult;
  inboundTranslationSubject: TranslationResult;
  inboundTranslationBody: TranslationResult;
  detectedCustomerLanguage: string | null;
  fallbackReplyLanguage: string;
  preferredReplyLanguage: string;
}) {
  const supabase = getSupabaseAdmin();

  if (!input.filterResult.allowed) {
    const { data: ignoredDecision } = await supabase
      .from("support_decisions")
      .insert({
        tenant_id: input.tenantId,
        conversation_id: input.conversationId,
        source_message_id: input.sourceMessageId ?? null,
        intent: "fallback",
        confidence: 0.99,
        decision: "ignore",
        requires_human: false,
        reasons: [input.filterResult.reason],
        actions: [],
        draft_subject_original: input.email.subject,
        draft_body_original: "",
        draft_language: input.preferredReplyLanguage,
        draft_subject_english: input.inboundTranslationSubject.translatedText,
        draft_body_english: "",
        translation_status: input.preferredReplyLanguage === "en" ? "not_needed" : "done",
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
      .eq("id", input.conversationId);

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

    return {
      conversationId: input.conversationId,
      decisionId: ignoredDecision?.id ?? null,
      status: "ignored" as const,
    };
  }

  let decision: ReturnType<typeof buildFallbackDecision> | ReturnType<typeof validateDecision>;
  let model = "gpt-4.1-mini";
  let promptVersion = "v2";

  try {
    const knowledge = await retrieveKnowledgeContext(
      input.tenantId,
      `${input.email.subject}\n\n${input.email.text}`
    );

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildDecisionSystemPrompt(input.runtime, knowledge.context),
        },
        {
          role: "user",
          content: buildDecisionUserPrompt({
            subject: input.email.subject,
            body: input.email.text,
            customerEmail: input.email.from.email,
            customerName: input.email.from.name ?? null,
            receivedAt: input.email.receivedAt,
            detectedCustomerLanguage: input.detectedCustomerLanguage,
            fallbackReplyLanguage: input.fallbackReplyLanguage,
          }),
        },
      ],
      max_completion_tokens: 900,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const rawDecision = validateDecision(extractJsonObject(raw));
    decision = {
      ...rawDecision,
      draft: {
        ...rawDecision.draft,
        language:
          input.detectedCustomerLanguage ??
          normalizeLanguage(rawDecision.draft.language) ??
          input.fallbackReplyLanguage,
      },
    };
  } catch (error) {
    console.error("[runInboundEmailPipeline/decision]", error);
    model = "system-fallback";
    promptVersion = "v2-fallback";
    const message = error instanceof Error ? error.message : "Unknown AI pipeline error";
    decision = buildFallbackDecision({
      subject: input.email.subject,
      preferredReplyLanguage: input.preferredReplyLanguage,
      reason: message,
    });
  }

  const signedDraftBody = appendConfiguredSignature(decision.draft.body, input.runtime.config.signature);

  const [translatedDraftSubject, translatedDraftBody] = await Promise.all([
    translateForUi({
      tenantId: input.tenantId,
      text: decision.draft.subject,
      sourceLanguage: decision.draft.language,
      contextType: "subject",
    }),
    translateForUi({
      tenantId: input.tenantId,
      text: signedDraftBody,
      sourceLanguage: decision.draft.language,
      contextType: "draft",
    }),
  ]);

  const reviewStatus =
    decision.decision === "ignore"
      ? "ignored"
      : decision.requires_human || decision.confidence < 0.8
        ? "pending_review"
        : "approved";

  const { data: savedDecision, error: decisionInsertError } = await supabase
    .from("support_decisions")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      source_message_id: input.sourceMessageId ?? null,
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
      model,
      prompt_version: promptVersion,
    })
    .select("id")
    .single();

  if (decisionInsertError || !savedDecision?.id) {
    throw new Error(
      `[pipeline] Failed to insert support_decision: ${decisionInsertError?.message ?? "no id returned"}`
    );
  }

  const desiredStatus: "ignored" | "pending_autosend" | "open" | "review" =
    decision.decision === "ignore"
      ? "ignored"
      : reviewStatus === "approved" &&
          input.runtime.config.autosendEnabled &&
          decision.confidence >= input.runtime.config.autosendThreshold
        ? "pending_autosend"
        : reviewStatus === "approved"
          ? "open"
          : "review";

  // Attempt conversation update; fall back to 'open' if desired status is rejected
  const { error: updateError } = await supabase
    .from("support_conversations")
    .update({
      latest_decision_id: savedDecision.id,
      status: desiredStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId);

  let conversationStatus = desiredStatus;

  if (updateError) {
    console.error(
      `[pipeline] conversation update failed (status=${desiredStatus}): ${updateError.message}`,
      { conversationId: input.conversationId, decisionId: savedDecision.id }
    );

    if (desiredStatus === "pending_autosend") {
      // Retry with a safe visible status so the draft is still reachable
      conversationStatus = "open";
      const { error: fallbackError } = await supabase
        .from("support_conversations")
        .update({
          latest_decision_id: savedDecision.id,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.conversationId);

      if (fallbackError) {
        throw new Error(
          `[pipeline] conversation update failed even with fallback status 'open': ${fallbackError.message}`
        );
      }
      console.warn(
        `[pipeline] fell back to status='open' for conversation ${input.conversationId} (autosend update failed)`
      );
    } else {
      throw new Error(
        `[pipeline] conversation update failed (status=${desiredStatus}): ${updateError.message}`
      );
    }
  }

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
    conversationId: input.conversationId,
    decisionId: savedDecision.id,
    status: conversationStatus,
  };
}

export async function rerunConversationDecision(input: {
  tenantId: string;
  conversationId: string;
  sourceMessageId?: string | null;
  email: NormalizedInboundEmail;
}) {
  const runtime = await loadTenantRuntime(input.tenantId);
  const filterResult = filterInboundEmail(input.email, runtime.channel.outboundFromEmail);
  const [inboundTranslationSubject, inboundTranslationBody] = await Promise.all([
    translateForUi({
      tenantId: input.tenantId,
      text: input.email.subject,
      contextType: "subject",
    }),
    translateForUi({
      tenantId: input.tenantId,
      text: input.email.text,
      contextType: "customer_message",
    }),
  ]);

  const detectedCustomerLanguage =
    normalizeLanguage(inboundTranslationBody.sourceLanguage) ??
    normalizeLanguage(inboundTranslationSubject.sourceLanguage);
  const fallbackReplyLanguage = normalizeLanguage(runtime.config.languageDefault) ?? "nl";
  const preferredReplyLanguage = detectedCustomerLanguage ?? fallbackReplyLanguage;

  await getSupabaseAdmin()
    .from("support_conversations")
    .update({
      latest_message_at: input.email.receivedAt,
      updated_at: new Date().toISOString(),
      status: filterResult.allowed ? "review" : "ignored",
      customer_email: input.email.from.email,
      customer_name: input.email.from.name ?? null,
      subject_original: input.email.subject,
      subject_english: inboundTranslationSubject.translatedText,
      latest_inbound_message_id: input.sourceMessageId ?? null,
    })
    .eq("id", input.conversationId);

  return generateConversationDecision({
    tenantId: input.tenantId,
    email: input.email,
    conversationId: input.conversationId,
    sourceMessageId: input.sourceMessageId ?? null,
    runtime,
    filterResult,
    inboundTranslationSubject,
    inboundTranslationBody,
    detectedCustomerLanguage,
    fallbackReplyLanguage,
    preferredReplyLanguage,
  });
}

export async function runInboundEmailPipeline(input: {
  tenantId: string;
  email: NormalizedInboundEmail;
  conversationId?: string;
}) {
  const supabase = getSupabaseAdmin();
  const runtime = await loadTenantRuntime(input.tenantId);
  const initialFilterResult = filterInboundEmail(input.email, runtime.channel.outboundFromEmail);
  const filterResult =
    !initialFilterResult.allowed &&
    input.conversationId &&
    initialFilterResult.reason === "Body too short"
      ? ({ allowed: true } as const)
      : initialFilterResult;

  if (initialFilterResult !== filterResult) {
    console.log(
      `[pipeline] allowed short threaded reply — conversation=${input.conversationId} from=${input.email.from.email} subject="${input.email.subject.slice(0, 80)}"`
    );
  }

  // ── Short-circuit filtered inbound BEFORE any DB writes ───────────────────
  // Self-email loops, newsletters, bulk mail, and other noise should never
  // create conversations, messages, or decisions. Short replies are allowed
  // only after header threading has already matched an existing conversation.
  if (!filterResult.allowed) {
    // Log to support_events for analytics/debugging, but don't persist to inbox
    await supabase.from("support_events").insert({
      tenant_id: input.tenantId,
      request_id: input.email.providerMessageId,
      source: "resend",
      subject: input.email.subject.slice(0, 120),
      intent: "filtered",
      confidence: 1,
      latency_ms: 0,
      draft_text: null,
      outcome: `filtered:${filterResult.category}`,
    });

    console.log(
      `[pipeline] filtered inbound (${filterResult.category}): ${filterResult.reason} — from=${input.email.from.email} subject="${input.email.subject.slice(0, 80)}"`
    );

    return {
      conversationId: input.conversationId ?? null,
      decisionId: null,
      status: "filtered" as const,
      filterReason: filterResult.reason,
      filterCategory: filterResult.category,
    };
  }

  const [inboundTranslationSubject, inboundTranslationBody] = await Promise.all([
    translateForUi({
      tenantId: input.tenantId,
      text: input.email.subject,
      contextType: "subject",
    }),
    translateForUi({
      tenantId: input.tenantId,
      text: input.email.text,
      contextType: "customer_message",
    }),
  ]);

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
      status: "review",
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

  return generateConversationDecision({
    tenantId: input.tenantId,
    email: input.email,
    conversationId,
    sourceMessageId: inboundMessage?.id ?? null,
    runtime,
    filterResult,
    inboundTranslationSubject,
    inboundTranslationBody,
    detectedCustomerLanguage,
    fallbackReplyLanguage,
    preferredReplyLanguage,
  });
}
