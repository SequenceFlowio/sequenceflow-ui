import { NextRequest, NextResponse } from "next/server";

import { analyticsWindow, parseAnalyticsDays } from "@/lib/analytics/core";
import { ANALYTICS_PLANS, getTenantPlan } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan } = await getTenantPlan(tenantId);
    if (!ANALYTICS_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Analytics requires Pro plan", upgrade: true }, { status: 403 });
    }
    const range = analyticsWindow(parseAnalyticsDays(new URL(req.url).searchParams.get("days")));
    const supabase = getSupabaseAdmin();
    const [conversationResult, legacyResult] = await Promise.all([
      supabase.from("support_conversations").select("status,latest_decision_id").eq("tenant_id", tenantId).gte("created_at", range.since),
      supabase.from("tickets").select("intent,confidence,status").eq("tenant_id", tenantId).gte("created_at", range.since),
    ]);
    if (conversationResult.error) throw new Error(conversationResult.error.message);
    if (legacyResult.error) throw new Error(legacyResult.error.message);
    const conversations = conversationResult.data ?? [];
    const decisionIds = conversations.map((row) => row.latest_decision_id).filter(Boolean);
    const decisionResult = decisionIds.length
      ? await supabase.from("support_decisions").select("id,intent,confidence").eq("tenant_id", tenantId).in("id", decisionIds)
      : { data: [] as Array<{ id: string; intent: string | null; confidence: number | null }>, error: null };
    if (decisionResult.error) throw new Error(decisionResult.error.message);
    const decisionById = new Map((decisionResult.data ?? []).map((row) => [row.id, row]));
    const rows = [
      ...conversations.flatMap((conversation) => {
        const decision = conversation.latest_decision_id ? decisionById.get(conversation.latest_decision_id) : null;
        return decision ? [{ intent: decision.intent, confidence: decision.confidence, status: conversation.status }] : [];
      }),
      ...(legacyResult.data ?? []),
    ];
    const grouped = new Map<string, { count: number; confidenceTotal: number; confidenceCount: number; escalated: number }>();
    for (const row of rows) {
      const intent = row.intent || "fallback";
      if (["fallback", "unknown"].includes(intent)) continue;
      const bucket = grouped.get(intent) ?? { count: 0, confidenceTotal: 0, confidenceCount: 0, escalated: 0 };
      bucket.count += 1;
      const confidence = Number(row.confidence);
      if (Number.isFinite(confidence)) {
        bucket.confidenceTotal += confidence;
        bucket.confidenceCount += 1;
      }
      if (row.status === "escalated") bucket.escalated += 1;
      grouped.set(intent, bucket);
    }
    const insights: Array<{ type: "low_confidence" | "high_escalation"; intent: string; count: number; avgConfidence: number | null; escalationRate: number }> = [];
    for (const [intent, bucket] of grouped) {
      if (bucket.count < 3) continue;
      const avgConfidence = bucket.confidenceCount ? bucket.confidenceTotal / bucket.confidenceCount : null;
      const escalationRate = bucket.escalated / bucket.count;
      if (avgConfidence !== null && avgConfidence < 0.65) insights.push({ type: "low_confidence", intent, count: bucket.count, avgConfidence, escalationRate });
      if (escalationRate >= 0.4) insights.push({ type: "high_escalation", intent, count: bucket.count, avgConfidence, escalationRate });
    }
    insights.sort((left, right) => right.count - left.count);
    return NextResponse.json(insights);
  } catch (error) {
    console.error("[analytics/insights]", error);
    return NextResponse.json({ error: "Analytics insights unavailable", retryable: true }, { status: 500 });
  }
}
