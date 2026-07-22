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
      supabase.from("support_conversations").select("latest_decision_id").eq("tenant_id", tenantId).gte("created_at", range.since),
      supabase.from("tickets").select("intent,confidence").eq("tenant_id", tenantId).gte("created_at", range.since),
    ]);
    if (conversationResult.error) throw new Error(conversationResult.error.message);
    if (legacyResult.error) throw new Error(legacyResult.error.message);
    const decisionIds = (conversationResult.data ?? []).map((row) => row.latest_decision_id).filter(Boolean);
    const decisionResult = decisionIds.length
      ? await supabase.from("support_decisions").select("intent,confidence").eq("tenant_id", tenantId).in("id", decisionIds)
      : { data: [] as Array<{ intent: string | null; confidence: number | null }>, error: null };
    if (decisionResult.error) throw new Error(decisionResult.error.message);

    const grouped = new Map<string, { count: number; confidenceTotal: number; confidenceCount: number }>();
    for (const row of [...(decisionResult.data ?? []), ...(legacyResult.data ?? [])]) {
      const intent = row.intent || "fallback";
      const bucket = grouped.get(intent) ?? { count: 0, confidenceTotal: 0, confidenceCount: 0 };
      bucket.count += 1;
      const confidence = Number(row.confidence);
      if (Number.isFinite(confidence)) {
        bucket.confidenceTotal += confidence;
        bucket.confidenceCount += 1;
      }
      grouped.set(intent, bucket);
    }
    const result = [...grouped.entries()].map(([intent, bucket]) => ({
      intent,
      count: bucket.count,
      avgConfidence: bucket.confidenceCount ? bucket.confidenceTotal / bucket.confidenceCount : null,
    })).sort((left, right) => {
      const leftFallback = ["fallback", "unknown"].includes(left.intent);
      const rightFallback = ["fallback", "unknown"].includes(right.intent);
      if (leftFallback !== rightFallback) return leftFallback ? 1 : -1;
      return right.count - left.count;
    }).slice(0, 8);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[analytics/intents]", error);
    return NextResponse.json({ error: "Analytics intents unavailable", retryable: true }, { status: 500 });
  }
}
