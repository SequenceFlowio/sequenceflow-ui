import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read the tenant's agent profile + all facts for the review UI. */
export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const supabase = getSupabaseAdmin();
  const [profileResult, factsResult, learningEventsResult, learningMetricsResult] = await Promise.all([
    supabase
      .from("tenant_agent_profile")
      .select("version, status, identity, voice_notes, stats, updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_profile_facts")
      .select("id, kind, intent, content, source_refs, confidence, status, origin, created_at")
      .eq("tenant_id", tenantId)
      .neq("status", "rejected")
      .order("kind", { ascending: true })
      .order("confidence", { ascending: false, nullsFirst: false }),
    supabase
      .from("profile_learning_events")
      .select("id, decision_id, proposed_fact_id, normalized_ai, normalized_human, normalized_diff, edit_distance, classification, candidate_rule, confidence, status, processing_ms, processed_at")
      .eq("tenant_id", tenantId)
      .order("processed_at", { ascending: false })
      .limit(50),
    supabase.rpc("profile_learning_metrics", { p_tenant_id: tenantId }),
  ]);

  const loadError = profileResult.error || factsResult.error || learningEventsResult.error || learningMetricsResult.error;
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  const profile = profileResult.data;
  const facts = factsResult.data;
  const learningEvents = learningEventsResult.data;
  const learningMetricRows = learningMetricsResult.data;
  const decisionIds = (learningEvents ?? []).map((event) => event.decision_id);
  const { data: sourceDecisions, error: sourceDecisionError } = decisionIds.length
    ? await supabase.from("support_decisions").select("id,conversation_id").eq("tenant_id", tenantId).in("id", decisionIds)
    : { data: [] as Array<{ id: string; conversation_id: string }>, error: null };
  if (sourceDecisionError) return NextResponse.json({ error: sourceDecisionError.message }, { status: 500 });
  const sourceConversationByDecision = new Map((sourceDecisions ?? []).map((decision) => [decision.id, decision.conversation_id]));

  const learningMetrics = learningMetricRows?.[0];
  return NextResponse.json({
    profile: profile ?? null,
    facts: facts ?? [],
    learning: {
      events: (learningEvents ?? []).map((event) => ({
        ...event,
        conversation_id: sourceConversationByDecision.get(event.decision_id) ?? null,
      })),
      metrics: {
        reviewedDecisions: Number(learningMetrics?.reviewed_decisions ?? 0),
        corrections: Number(learningMetrics?.corrections ?? 0),
        correctionRate: Number(learningMetrics?.correction_rate ?? 0),
        medianEditDistance: Number(learningMetrics?.median_edit_distance ?? 0),
      },
    },
  });
}

/** Activate the profile (or update identity/voice after white-glove edits). */
export async function PATCH(req: Request) {
  let tenantId: string;
  let role: string;
  try {
    ({ tenantId, role } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: { status?: string; identity?: Record<string, unknown>; voiceNotes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status === "active" || body.status === "draft") patch.status = body.status;
  if (body.identity && typeof body.identity === "object") patch.identity = body.identity;
  if (typeof body.voiceNotes === "string") patch.voice_notes = body.voiceNotes;

  const { error } = await getSupabaseAdmin()
    .from("tenant_agent_profile")
    .update(patch)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
