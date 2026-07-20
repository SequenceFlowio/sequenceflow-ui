import crypto from "crypto";

import { getOpenAIClient } from "@/lib/openaiClient";
import { createCancellationProposal } from "@/lib/commerce/actions";
import { buildCommercePromptContext, resolveCommerceForInbound } from "@/lib/commerce/resolution";
import { unverifiedCommerceClaims } from "@/lib/commerce/claims";
import { loadCaseMemoryContext, recordRepeatContact } from "@/lib/commerce/caseMemory";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantRuntime } from "@/lib/tenants/loadTenantRuntime";
import { retrieveKnowledgeContext } from "@/lib/knowledge/retrieveKnowledgeContext";
import { retrieveAgentProfileContext } from "@/lib/agentProfile/retrieveAgentProfileContext";
import { buildDecisionSystemPrompt, buildDecisionUserPrompt } from "@/lib/ai/decision/buildDecisionPrompt";
import { extractJsonObject, validateDecision } from "@/lib/ai/decision/validateDecision";
import { translateForUi } from "@/lib/ai/translation/translateForUi";
import { filterInboundEmail } from "@/lib/email/inbound/filterInboundEmail";
import { isTenantSenderBlocked } from "@/lib/email/inbound/senderFilters";
import { saveInboundMessageAttachments } from "@/lib/email/inbound/messageAttachments";
import { appendConfiguredSignature } from "@/lib/email/signature";
import { normalizeLanguage } from "@/lib/language/normalizeLanguage";
import type { NormalizedInboundEmail } from "@/types/aiInbox";

type TranslationResult = Awaited<ReturnType<typeof translateForUi>>;
type PipelineRuntime = Awaited<ReturnType<typeof loadTenantRuntime>>;
type FilterResult = ReturnType<typeof filterInboundEmail>;
type DecisionThreadMessage = { role: string; text: string };

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
  previousMessages?: DecisionThreadMessage[];
  regenerationInstructions?: string | null;
  forceHumanReview?: boolean;
  linkedSucceededActionId?: string | null;
}) {
  const supabase = getSupabaseAdmin();

  if (!input.filterResult.allowed && !input.forceHumanReview) {
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
        draft_body_ai: "",
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
      source: input.email.provider,
      subject: null,
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
  const commerceResolution = await resolveCommerceForInbound({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    customerEmail: input.email.from.email,
    subject: input.email.subject,
    body: input.email.text,
  }).catch((error) => {
    console.error("[pipeline/commerce-resolution]", error);
    return null;
  });

  try {
    const [knowledge, agentProfile] = await Promise.all([
      retrieveKnowledgeContext(input.tenantId, `${input.email.subject}\n\n${input.email.text}`),
      retrieveAgentProfileContext(input.tenantId, `${input.email.subject}\n\n${input.email.text}`),
    ]);

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildDecisionSystemPrompt(input.runtime, knowledge.context, agentProfile.context, buildCommercePromptContext(commerceResolution)),
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
            previousMessages: input.previousMessages,
            regenerationInstructions: input.regenerationInstructions,
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
    if (decision.actions.some((action) => action.type === "cancel_order")) {
      decision = { ...decision, requires_human: true };
    }
    const unverifiedClaims = commerceResolution ? unverifiedCommerceClaims(decision.draft.body, commerceResolution.order ? {
      cancelledAt: commerceResolution.order.cancelledAt,
      financialStatus: commerceResolution.order.financialStatus,
      fulfillmentStatus: commerceResolution.order.fulfillmentStatus,
      hasFulfillment: commerceResolution.order.fulfillments.length > 0,
    } : null) : [];
    if (unverifiedClaims.length) {
      throw new Error(`Draft asserted unverified commerce status: ${unverifiedClaims.join(", ")}.`);
    }
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

  if (input.forceHumanReview) {
    decision = {
      ...decision,
      requires_human: true,
      actions: [],
      reasons: [...decision.reasons, "Fresh confirmation draft generated after verified commerce success."],
    };
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
    decision.decision === "ignore" && !input.forceHumanReview
      ? "ignored"
      : input.forceHumanReview || decision.requires_human || decision.confidence < 0.8
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
      draft_body_ai: signedDraftBody,
      draft_language: decision.draft.language,
      draft_subject_english: translatedDraftSubject.translatedText,
      draft_body_english: translatedDraftBody.translatedText,
      translation_status: decision.draft.language === "en" ? "not_needed" : "done",
      review_status: reviewStatus,
      model,
      prompt_version: promptVersion,
      blocking_action_id: input.linkedSucceededActionId ?? null,
    })
    .select("id")
    .single();

  if (decisionInsertError || !savedDecision?.id) {
    throw new Error(
      `[pipeline] Failed to insert support_decision: ${decisionInsertError?.message ?? "no id returned"}`
    );
  }

  const cancellationAction = decision.actions.find((action) => action.type === "cancel_order");
  if (cancellationAction) {
    if (!commerceResolution?.order) {
      throw new Error("Cancellation action was proposed without one verified order; the draft remains blocked from the conversation.");
    }
    const proposal = await createCancellationProposal({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      decisionId: savedDecision.id,
      sourceMessageId: input.sourceMessageId ?? null,
      orderId: commerceResolution.order.id,
      customerText: `${input.email.subject}\n${input.email.text}`,
      rationale: "Customer explicitly requested cancellation of the linked order.",
    });
    if (!proposal) throw new Error("Cancellation proposal failed the explicit-intent or tenant-policy guard; the draft remains blocked.");
  }

  const desiredStatus: "ignored" | "pending_autosend" | "open" | "review" =
    decision.decision === "ignore" && !input.forceHumanReview
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
      scheduled_send_at: null,
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
          scheduled_send_at: null,
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
    source: input.email.provider,
    subject: null,
    intent: decision.intent,
    confidence: decision.confidence,
    latency_ms: 0,
    draft_text: null,
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
  regenerationInstructions?: string | null;
  forceHumanReview?: boolean;
  linkedSucceededActionId?: string | null;
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
  const previousMessages = await loadDecisionThreadHistory(input.conversationId, input.sourceMessageId);

  const { error: updateError } = await getSupabaseAdmin()
    .from("support_conversations")
    .update({
      latest_message_at: input.email.receivedAt,
      updated_at: new Date().toISOString(),
      status: filterResult.allowed || input.forceHumanReview ? "review" : "ignored",
      scheduled_send_at: null,
      customer_email: input.email.from.email,
      customer_name: input.email.from.name ?? null,
      subject_original: input.email.subject,
      subject_english: inboundTranslationSubject.translatedText,
      latest_inbound_message_id: input.sourceMessageId ?? null,
    })
    .eq("id", input.conversationId);

  if (updateError) {
    throw new Error(`[pipeline] failed to update conversation before regenerate: ${updateError.message}`);
  }

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
    previousMessages,
    regenerationInstructions: input.regenerationInstructions,
    forceHumanReview: input.forceHumanReview,
    linkedSucceededActionId: input.linkedSucceededActionId,
  });
}

async function loadDecisionThreadHistory(
  conversationId: string,
  latestInboundMessageId?: string | null,
): Promise<DecisionThreadMessage[]> {
  const { data: messages, error } = await getSupabaseAdmin()
    .from("support_messages")
    .select("id, direction, body_original")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[pipeline/thread-history]", error.message);
    return [];
  }

  return (messages ?? [])
    .filter((message) => message.id !== latestInboundMessageId)
    .slice(-8)
    .map((message) => ({
      role: message.direction === "outbound" ? "assistant" : "customer",
      text: String(message.body_original ?? "").trim(),
    }))
    .filter((message) => message.text.length > 0);
}

export async function runInboundEmailPipeline(input: {
  tenantId: string;
  email: NormalizedInboundEmail;
  conversationId?: string;
}) {
  const supabase = getSupabaseAdmin();
  const runtime = await loadTenantRuntime(input.tenantId);
  const senderIsBlocked = await isTenantSenderBlocked(input.tenantId, input.email.from.email, supabase);
  const initialFilterResult: FilterResult = senderIsBlocked
    ? { allowed: false, reason: "Tenant sender filter", category: "internal" }
    : filterInboundEmail(input.email, runtime.channel.outboundFromEmail);
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
    // Log to support_events for analytics/debugging, but don't persist to inbox.
    // We stash the specific filter reason + sender into `draft_text` (no schema
    // change needed) so we can audit false-positives later — e.g. when a real
    // customer reply gets mis-categorized as `automated` and we need to know
    // which filter rule triggered.
    const auditBlob = JSON.stringify({
      reason: filterResult.reason,
      from: input.email.from.email,
      subject: input.email.subject?.slice(0, 200) ?? null,
    });
    await supabase.from("support_events").insert({
      tenant_id: input.tenantId,
      request_id: input.email.providerMessageId,
      source: input.email.provider,
      subject: input.email.subject?.slice(0, 120) ?? null,
      intent: "filtered",
      confidence: 1,
      latency_ms: 0,
      draft_text: auditBlob,
      outcome: `filtered:${filterResult.category}`,
    });

    console.log(`[pipeline] filtered inbound (${filterResult.category}): ${filterResult.reason}`);

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
    const { error: conversationInsertError } = await supabase.from("support_conversations").insert({
      id: conversationId,
      tenant_id: input.tenantId,
      status: "review",
      customer_email: input.email.from.email,
      customer_name: input.email.from.name ?? null,
      subject_original: input.email.subject,
      subject_english: inboundTranslationSubject.translatedText,
      latest_message_at: input.email.receivedAt,
    });
    if (conversationInsertError) {
      throw new Error(`[pipeline] failed to create conversation: ${conversationInsertError.message}`);
    }
  }

  const { data: inboundMessage, error: inboundInsertError } = await supabase
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

  if (inboundInsertError || !inboundMessage?.id) {
    throw new Error(
      `[pipeline] failed to insert inbound message: ${inboundInsertError?.message ?? "no id returned"}`
    );
  }

  try {
    await saveInboundMessageAttachments(supabase, {
      tenantId: input.tenantId,
      conversationId,
      messageId: inboundMessage.id,
      attachments: input.email.attachments,
    });
  } catch (attachmentError) {
    console.error("[pipeline/inbound-attachments]", attachmentError);
  }

  const [threadHistory, caseMemory] = await Promise.all([
    loadDecisionThreadHistory(conversationId, inboundMessage.id),
    loadCaseMemoryContext(input.tenantId, input.email.from.email).catch(() => []),
  ]);
  const previousMessages = [...caseMemory, ...threadHistory];
  await recordRepeatContact({ tenantId: input.tenantId, conversationId, customerEmail: input.email.from.email, receivedAt: input.email.receivedAt }).catch((error) => console.error("[pipeline/repeat-contact]", error));

  const { error: conversationUpdateError } = await supabase
    .from("support_conversations")
    .update({
      latest_inbound_message_id: inboundMessage.id,
      latest_message_at: input.email.receivedAt,
      updated_at: new Date().toISOString(),
      status: filterResult.allowed ? "review" : "ignored",
      scheduled_send_at: null,
      customer_email: input.email.from.email,
      customer_name: input.email.from.name ?? null,
      subject_original: input.email.subject,
      subject_english: inboundTranslationSubject.translatedText,
    })
    .eq("id", conversationId);

  if (conversationUpdateError) {
    throw new Error(`[pipeline] failed to update conversation for latest inbound: ${conversationUpdateError.message}`);
  }

  return generateConversationDecision({
    tenantId: input.tenantId,
    email: input.email,
    conversationId,
    sourceMessageId: inboundMessage.id,
    runtime,
    filterResult,
    inboundTranslationSubject,
    inboundTranslationBody,
    detectedCustomerLanguage,
    fallbackReplyLanguage,
    preferredReplyLanguage,
    previousMessages,
  });
}
