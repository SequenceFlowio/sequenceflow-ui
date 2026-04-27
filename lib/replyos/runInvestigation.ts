import { getOpenAIClient } from "@/lib/openaiClient";
import { extractVisibleReplyText } from "@/lib/email/inbound/replyText";
import { retrieveKnowledgeContext } from "@/lib/knowledge/retrieveKnowledgeContext";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type InvestigationCitation = {
  title?: string;
  url: string;
  snippet?: string;
};

type InvestigationOutput = {
  improvedDraft: string;
  citations: InvestigationCitation[];
  reasoning: string[];
};

type InvestigationResult = {
  runId: string;
  status: "ready_to_reply" | "failed";
  finalAnswer: string | null;
  citations: InvestigationCitation[];
};

type ConversationRow = {
  id: string;
  tenant_id: string;
  customer_email: string | null;
  customer_name: string | null;
  subject_original: string | null;
  subject_english: string | null;
  latest_decision_id: string | null;
};

type MessageRow = {
  id: string;
  subject_original: string | null;
  body_original: string | null;
  subject_english: string | null;
  body_english: string | null;
  language_original: string | null;
  received_at: string | null;
  created_at: string | null;
};

type DecisionRow = {
  id: string;
  draft_subject_original: string | null;
  draft_body_original: string | null;
  draft_language: string | null;
  intent: string | null;
  confidence: number | null;
  reasons: unknown;
};

function summarizeObjective(subject: string | null, body: string | null) {
  const text = `${subject ?? ""} ${body ?? ""}`.replace(/\s+/g, " ").trim();
  if (!text) return "Research this support ticket and improve the reply.";
  return `Research this support ticket and improve the reply: ${text.slice(0, 180)}`;
}

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeInvestigationOutput(raw: string): InvestigationOutput {
  try {
    const parsed = JSON.parse(stripCodeFence(raw)) as Partial<InvestigationOutput>;
    return {
      improvedDraft: typeof parsed.improvedDraft === "string" ? parsed.improvedDraft.trim() : raw.trim(),
      citations: Array.isArray(parsed.citations)
        ? parsed.citations
            .map((citation) => ({
              title: typeof citation?.title === "string" ? citation.title : undefined,
              url: typeof citation?.url === "string" ? citation.url : "",
              snippet: typeof citation?.snippet === "string" ? citation.snippet : undefined,
            }))
            .filter((citation) => citation.url)
        : [],
      reasoning: Array.isArray(parsed.reasoning)
        ? parsed.reasoning.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return {
      improvedDraft: raw.trim(),
      citations: [],
      reasoning: ["The model returned a plain-text draft instead of JSON."],
    };
  }
}

function extractWebSearchSummaries(response: unknown): Array<{ summary: string; url: string | null }> {
  const output = (response as { output?: unknown[] })?.output;
  if (!Array.isArray(output)) return [];

  return output
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => item.type === "web_search_call")
    .map((item) => {
      const action = typeof item.action === "object" && item.action !== null ? item.action as Record<string, unknown> : null;
      const query = typeof action?.query === "string" ? action.query : null;
      const url = typeof action?.url === "string" ? action.url : null;
      const actionType = typeof action?.type === "string" ? action.type.replace(/_/g, " ") : "web search";
      return {
        summary: query ? `${actionType}: ${query}` : actionType,
        url,
      };
    });
}

function extractOutputText(response: unknown) {
  const direct = (response as { output_text?: unknown })?.output_text;
  if (typeof direct === "string" && direct.trim()) return direct;

  const output = (response as { output?: unknown[] })?.output;
  if (!Array.isArray(output)) return "";

  const chunks: string[] = [];
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

async function insertStep(input: {
  tenantId: string;
  runId: string;
  stepIndex: number;
  actionType: string;
  summary: string;
  status?: "recorded" | "blocked" | "failed" | "completed";
  url?: string | null;
  modelDecision?: string | null;
  metadata?: Record<string, unknown>;
  startedAt?: number;
}) {
  const durationMs = input.startedAt ? Math.max(0, Date.now() - input.startedAt) : null;
  const { error } = await getSupabaseAdmin().from("replyos_agent_steps").insert({
    tenant_id: input.tenantId,
    run_id: input.runId,
    step_index: input.stepIndex,
    action_type: input.actionType,
    status: input.status ?? "completed",
    url: input.url ?? null,
    summary: input.summary,
    model_decision: input.modelDecision ?? null,
    metadata: input.metadata ?? {},
    duration_ms: durationMs,
  });

  if (error) {
    console.error("[replyos/investigate] step insert failed:", error.message);
  }
}

async function updateRunFailed(runId: string, failureReason: string) {
  await getSupabaseAdmin()
    .from("replyos_agent_runs")
    .update({
      status: "failed",
      failure_reason: failureReason,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function callInvestigationModel(input: string) {
  const openai = getOpenAIClient();
  const models = ["gpt-5", "gpt-4.1"];
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const response = await openai.responses.create({
        model,
        instructions: [
          "You are ReplyOS Operator, a careful autonomous support research agent.",
          "Use web_search when public web context can improve the reply, such as tracking pages, public shipping policies, product pages, opening hours, or public store policies.",
          "Do not invent private order facts. If the answer requires a private admin system you cannot access, say what needs to be checked and write a safe draft.",
          "Keep the customer's language and tone. Return only valid JSON with keys: improvedDraft, citations, reasoning.",
          "citations must be an array of { title, url, snippet }. reasoning must be brief and explain what changed.",
        ].join("\n"),
        input,
        tools: [{ type: "web_search" as const }],
        include: ["web_search_call.action.sources"],
        max_output_tokens: 2200,
      });
      return { model, response };
    } catch (error) {
      lastError = error;
      console.warn(`[replyos/investigate] model ${model} failed`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Investigation model failed.");
}

export async function runInvestigation(input: {
  tenantId: string;
  conversationId: string;
}): Promise<InvestigationResult> {
  const supabase = getSupabaseAdmin();

  const { data: conversation, error: conversationError } = await supabase
    .from("support_conversations")
    .select("id, tenant_id, customer_email, customer_name, subject_original, subject_english, latest_decision_id")
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle<ConversationRow>();

  if (conversationError) {
    throw new Error(`Failed to load conversation: ${conversationError.message}`);
  }
  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const [{ data: latestMessage }, { data: latestDecision }] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, subject_original, body_original, subject_english, body_english, language_original, received_at, created_at")
      .eq("tenant_id", input.tenantId)
      .eq("conversation_id", input.conversationId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<MessageRow>(),
    conversation.latest_decision_id
      ? supabase
          .from("support_decisions")
          .select("id, draft_subject_original, draft_body_original, draft_language, intent, confidence, reasons")
          .eq("tenant_id", input.tenantId)
          .eq("id", conversation.latest_decision_id)
          .maybeSingle<DecisionRow>()
      : supabase
          .from("support_decisions")
          .select("id, draft_subject_original, draft_body_original, draft_language, intent, confidence, reasons")
          .eq("tenant_id", input.tenantId)
          .eq("conversation_id", input.conversationId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<DecisionRow>(),
  ]);

  const visibleCustomerBody = extractVisibleReplyText(latestMessage?.body_original ?? "");
  const objective = summarizeObjective(latestMessage?.subject_original ?? conversation.subject_original, visibleCustomerBody);

  const { data: run, error: runError } = await supabase
    .from("replyos_agent_runs")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      status: "running",
      objective,
      risk_level: "low",
      runtime_provider: "manual_watch",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (runError || !run?.id) {
    throw new Error(`Failed to create investigation run: ${runError?.message ?? "no id returned"}`);
  }

  const runId = run.id;
  let stepIndex = 1;

  try {
    await insertStep({
      tenantId: input.tenantId,
      runId,
      stepIndex: stepIndex++,
      actionType: "read_ticket",
      summary: "Read the latest customer message and current AI draft.",
      metadata: {
        customerEmail: conversation.customer_email,
        subject: latestMessage?.subject_original ?? conversation.subject_original,
        hasCurrentDraft: Boolean(latestDecision?.draft_body_original),
      },
    });

    const knowledgeStarted = Date.now();
    const knowledge = await retrieveKnowledgeContext(
      input.tenantId,
      `${latestMessage?.subject_original ?? conversation.subject_original ?? ""}\n\n${visibleCustomerBody}`
    );
    await insertStep({
      tenantId: input.tenantId,
      runId,
      stepIndex: stepIndex++,
      actionType: "read_knowledge",
      summary: knowledge.used
        ? `Checked ${knowledge.chunks} relevant knowledge chunk${knowledge.chunks === 1 ? "" : "s"}.`
        : "No matching knowledge chunks found.",
      startedAt: knowledgeStarted,
      metadata: { chunks: knowledge.chunks },
    });

    const prompt = [
      "Support ticket:",
      JSON.stringify({
        customer: {
          email: conversation.customer_email,
          name: conversation.customer_name,
        },
        subjectOriginal: latestMessage?.subject_original ?? conversation.subject_original,
        subjectEnglish: latestMessage?.subject_english ?? conversation.subject_english,
        latestCustomerMessage: visibleCustomerBody,
        latestCustomerMessageEnglish: latestMessage?.body_english ? extractVisibleReplyText(latestMessage.body_english) : null,
        currentDraft: latestDecision?.draft_body_original ?? null,
        currentDraftLanguage: latestDecision?.draft_language ?? latestMessage?.language_original ?? null,
        currentIntent: latestDecision?.intent ?? null,
        currentConfidence: latestDecision?.confidence ?? null,
        currentReasons: latestDecision?.reasons ?? [],
      }, null, 2),
      "",
      "Internal knowledge context:",
      knowledge.context || "No internal knowledge matched this ticket.",
      "",
      "Task:",
      "Research public context if useful, then produce a safer, more helpful improved draft. If no public research helps, improve the draft using only the ticket and internal knowledge.",
    ].join("\n");

    const modelStarted = Date.now();
    const { model, response } = await callInvestigationModel(prompt);
    const webSearchSteps = extractWebSearchSummaries(response);
    for (const step of webSearchSteps) {
      await insertStep({
        tenantId: input.tenantId,
        runId,
        stepIndex: stepIndex++,
        actionType: "web_search",
        summary: step.summary,
        url: step.url,
        startedAt: modelStarted,
      });
    }

    const rawOutput = extractOutputText(response);
    const output = normalizeInvestigationOutput(rawOutput);
    if (!output.improvedDraft) {
      throw new Error("Investigation completed without a draft.");
    }

    await insertStep({
      tenantId: input.tenantId,
      runId,
      stepIndex: stepIndex++,
      actionType: "draft_reply",
      summary: "Prepared an improved reply draft.",
      modelDecision: output.reasoning.join("\n") || null,
      startedAt: modelStarted,
      metadata: { model },
    });

    for (const citation of output.citations) {
      await insertStep({
        tenantId: input.tenantId,
        runId,
        stepIndex: stepIndex++,
        actionType: "source",
        summary: citation.title || citation.snippet || citation.url,
        url: citation.url,
        metadata: citation,
      });
    }

    const { error: updateError } = await supabase
      .from("replyos_agent_runs")
      .update({
        status: "ready_to_reply",
        final_answer: output.improvedDraft,
        model,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (updateError) {
      throw new Error(`Failed to update investigation run: ${updateError.message}`);
    }

    return {
      runId,
      status: "ready_to_reply",
      finalAnswer: output.improvedDraft,
      citations: output.citations,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed.";
    await insertStep({
      tenantId: input.tenantId,
      runId,
      stepIndex,
      actionType: "failed",
      status: "failed",
      summary: message,
    });
    await updateRunFailed(runId, message);
    return {
      runId,
      status: "failed",
      finalAnswer: null,
      citations: [],
    };
  }
}
