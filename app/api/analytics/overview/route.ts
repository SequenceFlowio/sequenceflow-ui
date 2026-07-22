import { NextRequest, NextResponse } from "next/server";

import { analyticsWindow, clampRate, classifyHandlingStatus, parseAnalyticsDays } from "@/lib/analytics/core";
import { ANALYTICS_PLANS, getTenantPlan } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const context = await getTenantId(req);
    const { plan } = await getTenantPlan(context.tenantId);
    if (!ANALYTICS_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Analytics requires Pro plan", upgrade: true }, { status: 403 });
    }

    const range = analyticsWindow(parseAnalyticsDays(new URL(req.url).searchParams.get("days")));
    const supabase = getSupabaseAdmin();
    const [conversationResult, legacyResult, autosendResult] = await Promise.all([
      supabase.from("support_conversations")
        .select("id,status,created_at,updated_at,latest_message_at,latest_decision_id")
        .eq("tenant_id", context.tenantId)
        .gte("created_at", range.since),
      supabase.from("tickets")
        .select("status,confidence,created_at,updated_at")
        .eq("tenant_id", context.tenantId)
        .gte("created_at", range.since),
      supabase.from("support_events")
        .select("id")
        .eq("tenant_id", context.tenantId)
        .eq("outcome", "autosend_sent")
        .gte("created_at", range.since),
    ]);
    if (conversationResult.error) throw new Error(conversationResult.error.message);
    if (legacyResult.error) throw new Error(legacyResult.error.message);
    if (autosendResult.error) throw new Error(autosendResult.error.message);

    const conversations = conversationResult.data ?? [];
    const decisionIds = conversations.map((conversation) => conversation.latest_decision_id).filter(Boolean);
    const decisionResult = decisionIds.length
      ? await supabase.from("support_decisions").select("id,confidence").eq("tenant_id", context.tenantId).in("id", decisionIds)
      : { data: [] as Array<{ id: string; confidence: number | null }>, error: null };
    if (decisionResult.error) throw new Error(decisionResult.error.message);
    const confidenceByDecision = new Map((decisionResult.data ?? []).map((decision) => [decision.id, decision.confidence]));

    const rows = [
      ...conversations.map((conversation) => ({
        status: conversation.status,
        confidence: conversation.latest_decision_id ? confidenceByDecision.get(conversation.latest_decision_id) ?? null : null,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at ?? conversation.latest_message_at ?? conversation.created_at,
      })),
      ...(legacyResult.data ?? []),
    ];
    const counts = { resolved: 0, review: 0, escalated: 0, ignored: 0, other: 0 };
    for (const row of rows) counts[classifyHandlingStatus(row.status)] += 1;
    const validConfidences = rows.map((row) => Number(row.confidence)).filter(Number.isFinite);
    const autoSentCount = Math.min(counts.resolved, autosendResult.data?.length ?? 0);
    const resolvedRows = rows.filter((row) => classifyHandlingStatus(row.status) === "resolved");
    const latencyRows = resolvedRows
      .map((row) => new Date(row.updated_at).getTime() - new Date(row.created_at).getTime())
      .filter((latency) => Number.isFinite(latency) && latency >= 0);

    return NextResponse.json({
      totalProcessed: rows.length,
      resolvedCount: counts.resolved,
      reviewCount: counts.review,
      escalationCount: counts.escalated,
      ignoredCount: counts.ignored,
      autoResolveRate: clampRate(autoSentCount, rows.length),
      autoSentCount,
      manualSentCount: Math.max(0, counts.resolved - autoSentCount),
      escalationRate: clampRate(counts.escalated, rows.length),
      pendingCount: counts.review,
      avgConfidence: validConfidences.length
        ? validConfidences.reduce((sum, confidence) => sum + confidence, 0) / validConfidences.length
        : null,
      confidenceSampleSize: validConfidences.length,
      avgLatencyMs: latencyRows.length
        ? Math.round(latencyRows.reduce((sum, latency) => sum + latency, 0) / latencyRows.length)
        : null,
      meta: {
        rangeDays: range.days,
        generatedAt: range.generatedAt,
        sampleSize: rows.length,
        canManage: context.role === "admin",
      },
    });
  } catch (error) {
    console.error("[analytics/overview]", error);
    return NextResponse.json({ error: "Analytics overview unavailable", retryable: true }, { status: 500 });
  }
}
