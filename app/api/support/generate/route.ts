import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkAiAnswerLimit } from "@/lib/billing";
import OpenAI from "openai";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { translateForUi } from "@/lib/ai/translation/translateForUi";
import { recordAiUsage } from "@/lib/ai/usage";
import { appendConfiguredSignature } from "@/lib/email/signature";
import { normalizeLanguage } from "@/lib/language/normalizeLanguage";
import { loadAgentConfig } from "@/lib/support/configLoader";
import {
  buildSupportSystemPrompt,
  buildSupportUserPrompt,
} from "@/lib/support/promptBuilder";
import { validateSupportResponse } from "@/lib/support/validateSupportResponse";
import type { SupportGenerateRequest } from "@/types/support";
import {
  authorizationErrorResponse,
  hasValidInternalSecret,
  requireRole,
  resolveTenantScope,
} from "@/lib/auth/authorization";

export const runtime = "nodejs";

// ─── Support event logging ─────────────────────────────────────────────────────

type SupportEventPayload = {
  tenantId: string;
  userId: string;
  requestId: string;
  source: string;
  intent: string | null;
  confidence: number | null;
  templateId: string | null;
  latencyMs: number;
  outcome: string;
};

async function upsertTicket(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: {
    tenantId: string;
    gmailMessageId: string | null;
    gmailThreadId: string | null;
    fromEmail: string;
    fromName: string;
    subject: string;
    bodyText: string;
    intent: string | null;
    confidence: number | null;
    aiDraft: object | null;
    status?: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase.from("tickets").insert({
    tenant_id:        params.tenantId,
    gmail_message_id: params.gmailMessageId,
    gmail_thread_id:  params.gmailThreadId,
    from_email:       params.fromEmail,
    from_name:        params.fromName || null,
    subject:          params.subject.slice(0, 255),
    body_text:        params.bodyText,
    intent:           params.intent,
    confidence:       params.confidence,
    status:           params.status ?? "draft",
    ai_draft:         params.aiDraft,
  }).select("id").single();

  if (error) {
    console.warn("[generate] ticket upsert failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

async function insertSupportEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  event: SupportEventPayload
): Promise<void> {
  const { error } = await supabase.from("support_events").insert({
    tenant_id:   event.tenantId,
    user_id:     event.userId,
    request_id:  event.requestId,
    source:      event.source,
    subject:     null,
    intent:      event.intent,
    confidence:  event.confidence,
    template_id: event.templateId,
    latency_ms:  event.latencyMs,
    draft_text:  null,
    outcome:     event.outcome,
  });

  if (error) {
    console.warn("[generate] support_event insert failed:", error.message);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function extractEmail(value: unknown): string {
  const str = String(value ?? "").trim();
  if (!str) return "";
  const match = str.match(/<([^>]+)>/);
  return (match?.[1] ?? str).trim();
}

function extractAndParseJSON(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found in model response.");
  }
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

// ─── Intent classifier (fallback only — LLM classifies in primary path) ────────

const VALID_INTENTS = new Set([
  "order_status", "return_request", "damaged", "missing_items",
  "complaint", "warranty", "cancellation", "payment",
  "shipping", "product_question", "compliment", "fallback",
]);

function sanitizeIntent(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  return VALID_INTENTS.has(s) ? s : "fallback";
}

const KNOWLEDGE_CHAR_BUDGET = 50_000;

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  // ── 1. Authenticate caller (cookie session, Bearer JWT, or internal secret) ─
  let callerRole: string;
  let userId: string;
  let authTenantId: string;

  const internalRequest = hasValidInternalSecret(req);
  if (internalRequest) {
    // Internal server-to-server call (cron → generate) — tenant_id from body
    callerRole   = "system";
    userId       = "system";
    authTenantId = "";
  } else {
    try {
      const context = requireRole(await getTenantId(req), ["admin"]);
      ({ tenantId: authTenantId, role: callerRole, userId } = context);
    } catch (err: unknown) {
      const { message, status } = authorizationErrorResponse(err);
      return NextResponse.json({ error: message }, { status });
    }
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const gmailMessageId = data.original_message_id || data.message_id || null;
  const gmailThreadId  = data.threadId || data.thread_id || null;


  // ── 2b. Resolve tenant — body takes priority over auth-derived tenant ──────
  // n8n sends the actual tenant_id being processed in the request body.
  // The auth JWT belongs to the machine user (n8n@sequenceflow.local) whose
  // own tenant_id is irrelevant here.
  let tenantId: string;
  try {
    tenantId = resolveTenantScope(
      { tenantId: authTenantId, role: callerRole, userId },
      data.tenant_id,
      { allowOverride: internalRequest }
    );
  } catch (err: unknown) {
    const { message, status } = authorizationErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id missing from request" }, { status: 400 });
  }

  // ── 2c. AI answer limit check ────────────────────────────────────────────
  try {
    const limitCheck = await checkAiAnswerLimit(tenantId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Monthly AI answer limit reached", used: limitCheck.used, limit: limitCheck.limit },
        { status: 402 }
      );
    }
  } catch (limitErr) {
    console.error("[generate] limit check failed:", limitErr);
    return NextResponse.json(
      { error: "Usage verification is temporarily unavailable." },
      { status: 503 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const source        = String(data.source ?? "api").trim();

  // subject is hoisted so the catch block can log it even on early failures
  let subject = "";

  try {
    // ── 3. Map incoming fields ───────────────────────────────────────────────
    subject = String(data.subject ?? "").trim();
    const ticketBody: string = String(
      data.body ?? data.text ?? data.snippet ?? ""
    ).trim();
    const from: string = extractEmail(
      data.from ?? data.From ?? data.sender ?? data.email
    );
    const customerName: string = data.customer?.name || from || "";

    // ── 4. Load tenant config (fallback if not configured yet) ───────────────
    let config: Awaited<ReturnType<typeof loadAgentConfig>>;
    try {
      config = await loadAgentConfig(tenantId);
    } catch {
      console.warn(`[generate] No agent config found for tenant "${tenantId}", using defaults`);
      config = {
        empathyEnabled:    true,
        allowDiscount:     false,
        maxDiscountAmount: 0,
        signature:         "",
        languageDefault:   "nl",
        autosendEnabled:   false,
        autosendThreshold: 0.8,
        autosendTime1:     "08:00",
        autosendTime2:     "16:00",
        replyTone:          "friendly_informal",
        replyPronounPreference: "informal",
      };
    }
    console.log("CONFIG USED IN GENERATE:", JSON.stringify({ tenantId, ...config }));

    if (!subject && !ticketBody) {
      return NextResponse.json({ error: "Missing subject/body" }, { status: 400 });
    }

    // ── STEP B: Full knowledge fetch ─────────────────────────────────────────
    // Fetch ALL ready document IDs for this tenant (client + platform docs)
    let knowledgeContext = "";
    let usedKnowledge    = false;

    try {
      const { data: readyDocs } = await supabaseAdmin
        .from("knowledge_documents")
        .select("id")
        .eq("status", "ready")
        .or(`client_id.eq.${tenantId},client_id.is.null`);

      const readyIds = (readyDocs ?? []).map((doc: { id: string }) => doc.id);

      if (readyIds.length > 0) {
        const { data: allChunks, error: chunkErr } = await supabaseAdmin
          .from("knowledge_chunks")
          .select("content, document_id, chunk_index")
          .in("document_id", readyIds)
          .order("document_id")
          .order("chunk_index");

        if (chunkErr) {
          console.warn("[generate] knowledge fetch failed:", chunkErr.message);
        } else {
          let budget = 0;
          const contextChunks: string[] = [];
          for (const chunk of allChunks ?? []) {
            if (budget + chunk.content.length > KNOWLEDGE_CHAR_BUDGET) break;
            contextChunks.push(chunk.content);
            budget += chunk.content.length;
          }

          if (contextChunks.length < (allChunks?.length ?? 0)) {
            console.warn(
              `[generate] knowledge truncated: ${contextChunks.length} of ${allChunks?.length} chunks (budget=${budget})`
            );
          }

          knowledgeContext = contextChunks.join("\n\n---\n\n");
          usedKnowledge    = contextChunks.length > 0;
          console.log(
            `[generate] knowledge=${budget} chars from ${contextChunks.length} chunks (docs=${readyIds.length})`
          );
        }
      }
    } catch (kErr: unknown) {
      console.warn(
        "[generate] knowledge fetch error:",
        kErr instanceof Error ? kErr.message : String(kErr)
      );
    }

    // ── STEP C: LLM generate ─────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const threadHistory: { role: string; text: string }[] = Array.isArray(data.thread_history)
      ? data.thread_history
      : [];

    const providedCustomerLanguage = normalizeLanguage(data.customer?.language);
    const languageProbeText = `${subject}\n\n${ticketBody}`.trim();
    let detectedCustomerLanguage = providedCustomerLanguage;

    if (!detectedCustomerLanguage && languageProbeText) {
      const detected = await translateForUi({
        tenantId,
        text: languageProbeText,
        contextType: "customer_message",
      });
      detectedCustomerLanguage = normalizeLanguage(detected.sourceLanguage);
    }

    const fallbackReplyLanguage = normalizeLanguage(config.languageDefault) ?? "nl";

    const ticketReq: SupportGenerateRequest = {
      subject,
      body:     ticketBody,
      channel:  data.channel,
      customer: {
        ...(data.customer ?? {}),
        language: detectedCustomerLanguage ?? data.customer?.language,
      },
      order:    data.order,
    };

    const baseSystem   = buildSupportSystemPrompt(config);
    const systemPrompt = usedKnowledge
      ? `${baseSystem}\n\nVOLLEDIGE KENNISBASIS VAN DE KLANT:\n${knowledgeContext}`
      : baseSystem;
    const userPrompt = buildSupportUserPrompt(ticketReq, config, threadHistory, {
      detectedCustomerLanguage,
      fallbackReplyLanguage,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      max_completion_tokens: 600,
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Model returned empty content.");

    const parsed         = extractAndParseJSON(raw);
    const validated      = validateSupportResponse(parsed);
    const resolvedIntent = sanitizeIntent(parsed.intent);

    console.log(`[generate] tenant=${tenantId} intent=${resolvedIntent}`);

    // ── STEP D: Confidence scoring ────────────────────────────────────────────
    const llmConfidence   = clamp01(validated.confidence);
    const finalConfidence = llmConfidence;

    // ── STEP E: Routing ───────────────────────────────────────────────────────
    const needsHuman = finalConfidence < 0.6 || validated.status === "NEEDS_HUMAN";
    const routing: "AUTO" | "HUMAN_REVIEW" = needsHuman ? "HUMAN_REVIEW" : "AUTO";

    // ── STEP E2: Autosend ticket status ───────────────────────────────────────
    // Queue for scheduled auto-send only when: autosend is enabled for this
    // tenant, the AI is confident enough (routing=AUTO), and the confidence
    // clears the tenant's own autosend threshold (may be stricter than 0.6).
    const ticketStatus =
      config.autosendEnabled &&
      routing === "AUTO" &&
      finalConfidence >= config.autosendThreshold
        ? "pending_autosend"
        : "draft";

    validated.draft.body = appendConfiguredSignature(validated.draft.body, config.signature);

    // Filter disallowed actions
    if (!config.allowDiscount) {
      validated.actions = validated.actions.filter(
        (action) => action.type !== "OFFER_DISCOUNT"
      );
    }

    console.log(
      `[generate] tenant=${tenantId} route=${routing} confidence=${finalConfidence.toFixed(2)} hasKnowledge=${usedKnowledge}`
    );

    await insertSupportEvent(supabaseAdmin, {
      tenantId,
      userId,
      requestId,
      source,
      intent:     resolvedIntent,
      confidence: finalConfidence,
      templateId: null,
      latencyMs:  Date.now() - startedAt,
      outcome:    routing === "AUTO" ? "auto" : "human_review",
    });

    const ticketId = await upsertTicket(supabaseAdmin, {
      tenantId,
      gmailMessageId,
      gmailThreadId,
      fromEmail:  from,
      fromName:   customerName,
      subject,
      bodyText:   ticketBody,
      intent:     resolvedIntent,
      confidence: finalConfidence,
      aiDraft:    { ...validated.draft, from },
      status:     ticketStatus,
    });

    await recordAiUsage({
      tenantId,
      legacyTicketId: ticketId,
      operation: "decision",
      model: "gpt-4.1-mini",
      usage: completion.usage,
      idempotencyKey: `${requestId}:legacy-decision`,
    });

    return NextResponse.json({
      status:     validated.status,
      confidence: finalConfidence,
      routing,
      draft: { ...validated.draft, from },
      knowledge: { used: usedKnowledge },
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await insertSupportEvent(supabaseAdmin, {
      tenantId,
      userId,
      requestId,
      source,
      intent:     null,
      confidence: null,
      templateId: null,
      latencyMs:  Date.now() - startedAt,
      outcome:    "error",
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
