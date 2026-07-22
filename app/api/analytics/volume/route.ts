import { NextRequest, NextResponse } from "next/server";

import { analyticsDateKeys, analyticsWindow, classifyHandlingStatus, parseAnalyticsDays } from "@/lib/analytics/core";
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
    const days = parseAnalyticsDays(new URL(req.url).searchParams.get("days"));
    const range = analyticsWindow(days);
    const supabase = getSupabaseAdmin();
    const [conversationResult, legacyResult] = await Promise.all([
      supabase.from("support_conversations").select("created_at,status").eq("tenant_id", tenantId).gte("created_at", range.since),
      supabase.from("tickets").select("created_at,status").eq("tenant_id", tenantId).gte("created_at", range.since),
    ]);
    if (conversationResult.error) throw new Error(conversationResult.error.message);
    if (legacyResult.error) throw new Error(legacyResult.error.message);

    const buckets = new Map(analyticsDateKeys(days).map((date) => [date, {
      date, count: 0, resolved: 0, review: 0, escalated: 0, ignored: 0, other: 0,
    }]));
    for (const row of [...(conversationResult.data ?? []), ...(legacyResult.data ?? [])]) {
      const bucket = buckets.get(row.created_at.slice(0, 10));
      if (!bucket) continue;
      bucket.count += 1;
      bucket[classifyHandlingStatus(row.status)] += 1;
    }
    return NextResponse.json([...buckets.values()]);
  } catch (error) {
    console.error("[analytics/volume]", error);
    return NextResponse.json({ error: "Analytics volume unavailable", retryable: true }, { status: 500 });
  }
}
