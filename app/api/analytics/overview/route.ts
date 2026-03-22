import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantPlan, ANALYTICS_PLANS } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan } = await getTenantPlan(tenantId);

    if (!ANALYTICS_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: "Analytics requires Growth or Scale plan", upgrade: true },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("support_events")
      .select("outcome, confidence, latency_ms")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    if (error) throw error;

    const rows = data ?? [];
    const total = rows.length;
    const autoResolved = rows.filter(r => r.outcome === "AUTO").length;
    const avgConfidence = total > 0
      ? rows.reduce((s, r) => s + (r.confidence ?? 0), 0) / total
      : 0;
    const avgLatencyMs = total > 0
      ? Math.round(rows.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / total)
      : 0;
    const escalated = rows.filter(r => r.outcome === "HUMAN_REVIEW" || r.outcome === "escalated").length;

    return NextResponse.json({
      totalProcessed:   total,
      autoResolveRate:  total > 0 ? Math.round((autoResolved / total) * 100) / 100 : 0,
      avgConfidence:    Math.round(avgConfidence * 100) / 100,
      avgLatencyMs,
      escalationRate:   total > 0 ? Math.round((escalated / total) * 100) / 100 : 0,
    });
  } catch (err) {
    console.error("[analytics/overview]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
