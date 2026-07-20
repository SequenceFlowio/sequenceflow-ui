import { NextResponse } from "next/server";

import { learningContentHash, normalizeLearningText, normalizedEditDistance, normalizedLearningDiff, parseLearningClassification, type LearningClassification } from "@/lib/agentProfile/learning";
import { createEmbedding } from "@/lib/embeddings";
import { getOpenAIClient } from "@/lib/openaiClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  return Boolean(process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`);
}

async function classify(ai: string, human: string): Promise<LearningClassification> {
  const completion = await getOpenAIClient().chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 400,
    messages: [
      { role: "system", content: `Classify a human edit to an AI customer-support draft. Return JSON only: {"classification":"fact|policy|tone|structure|other","candidate_rule":string|null,"confidence":0..1}. A candidate_rule must be a short reusable business rule, never a customer-specific fact, order number, email, name, address, quote, or signature. Use null when the edit is not reusable.` },
      { role: "user", content: `AI DRAFT:\n${ai}\n\nHUMAN VERSION:\n${human}` },
    ],
  });
  return parseLearningClassification(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const requestedLimit = Number(new URL(req.url).searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(0, Math.trunc(requestedLimit))) : 30;
  const { data: decisions, error } = await supabase.rpc("claim_profile_learning_decisions", { p_limit: limit });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let processed = 0;
  let proposed = 0;
  for (const decision of decisions ?? []) {
    const startedAt = Date.now();
    const eventId = decision.event_id;
    const normalizedAi = normalizeLearningText(decision.draft_body_ai ?? "");
    const normalizedHuman = normalizeLearningText(decision.draft_body_original ?? "");
    const editDistance = normalizedEditDistance(normalizedAi, normalizedHuman);
    const normalizedDiff = normalizedLearningDiff(normalizedAi, normalizedHuman);
    if (!normalizedAi || !normalizedHuman || editDistance < 0.03) {
      const { error: ignoredError } = await supabase.from("profile_learning_events").update({
        normalized_ai: normalizedAi,
        normalized_human: normalizedHuman, normalized_diff: normalizedDiff, edit_distance: editDistance,
        classification: "other", confidence: 1, status: "ignored", processing_ms: Date.now() - startedAt,
        processed_at: new Date().toISOString(), error: null,
      }).eq("id", eventId).eq("status", "processing");
      if (ignoredError) {
        console.error("[learn-from-edits/ignore]", eventId, ignoredError.message);
        continue;
      }
      processed += 1;
      continue;
    }
    try {
      const result = await classify(normalizedAi, normalizedHuman);
      const candidate = result.candidate_rule;
      const hash = candidate ? learningContentHash(candidate) : null;
      const shouldPropose = candidate && result.confidence >= 0.75 && !["structure", "other"].includes(result.classification);
      const { data: event, error: eventError } = await supabase.from("profile_learning_events").update({
        normalized_ai: normalizedAi,
        normalized_human: normalizedHuman, normalized_diff: normalizedDiff, edit_distance: editDistance, classification: result.classification,
        candidate_rule: candidate, confidence: result.confidence, content_hash: hash,
        processing_ms: Date.now() - startedAt, processed_at: new Date().toISOString(), error: null,
      }).eq("id", eventId).eq("status", "processing").select("id").single();
      if (eventError || !event) throw new Error(eventError?.message ?? "Learning event update failed.");
      let finalStatus: "processed" | "proposed" | "ignored" = "processed";
      let proposedFactId: string | null = null;
      if (shouldPropose && candidate) {
        const { data: sameHash } = await supabase.from("profile_learning_events").select("proposed_fact_id")
          .eq("tenant_id", decision.tenant_id).eq("content_hash", hash).not("proposed_fact_id", "is", null).neq("id", event.id).limit(1).maybeSingle();
        let duplicateFactId = sameHash?.proposed_fact_id ?? null;
        const embedding = duplicateFactId ? null : await createEmbedding(candidate.slice(0, 2000));
        if (!duplicateFactId && embedding) {
          const { data: similar } = await supabase.rpc("match_profile_fact_candidates", { query_embedding: embedding, filter_tenant_id: decision.tenant_id, match_threshold: 0.9, match_count: 1 });
          duplicateFactId = similar?.[0]?.id ?? null;
        }
        if (!duplicateFactId && embedding) {
          const kind = result.classification === "fact" ? "fact" : "house_rule";
          const { data: fact, error: factError } = await supabase.from("tenant_profile_facts").insert({
            tenant_id: decision.tenant_id, kind, content: candidate, confidence: result.confidence,
            source_refs: [{ decisionId: decision.decision_id, learningEventId: event.id }], status: "proposed", origin: "learning", embedding, content_hash: hash,
          }).select("id").single();
          if (fact) {
            proposedFactId = fact.id;
            finalStatus = "proposed";
            proposed += 1;
          } else if (factError?.code === "23505") {
            const { data: concurrentFact } = await supabase.from("tenant_profile_facts").select("id")
              .eq("tenant_id", decision.tenant_id).eq("content_hash", hash).maybeSingle();
            proposedFactId = concurrentFact?.id ?? null;
            finalStatus = "ignored";
          } else if (factError) {
            throw new Error(factError.message);
          }
        } else {
          proposedFactId = duplicateFactId;
          finalStatus = "ignored";
        }
      }
      const { error: finalizeError } = await supabase.from("profile_learning_events").update({
        status: finalStatus,
        proposed_fact_id: proposedFactId,
        processing_ms: Date.now() - startedAt,
        processed_at: new Date().toISOString(),
      }).eq("id", event.id).eq("status", "processing");
      if (finalizeError) throw new Error(finalizeError.message);
      processed += 1;
    } catch (classificationError) {
      const message = classificationError instanceof Error ? classificationError.message : "Learning classification failed.";
      const { error: failureStateError } = await supabase.from("profile_learning_events").update({
        normalized_ai: normalizedAi,
        normalized_human: normalizedHuman, normalized_diff: normalizedDiff, edit_distance: editDistance,
        classification: "other", confidence: 0, status: "failed", error: message,
        processing_ms: Date.now() - startedAt, processed_at: new Date().toISOString(),
      }).eq("id", eventId);
      if (failureStateError) console.error("[learn-from-edits/failure-state]", eventId, failureStateError.message);
    }
  }
  return NextResponse.json({ ok: true, scanned: decisions?.length ?? 0, processed, proposed });
}
