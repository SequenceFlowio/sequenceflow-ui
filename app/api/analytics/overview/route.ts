import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantPlan, ANALYTICS_PLANS } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan }     = await getTenantPlan(tenantId);

    if (!ANALYTICS_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: "Analytics requires Pro plan", upgrade: true },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const since    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("tickets")
      .select("status, confidence, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    if (error) throw error;

    const rows       = data ?? [];
    const total      = rows.length;
    const resolved   = rows.filter(r => r.status === "sent" || r.status === "approved");
    const escalated  = rows.filter(r => r.status === "escalated");
    const pending    = rows.filter(r => r.status === "draft" || r.status === "pending_autosend");

    const avgConfidence = total > 0
      ? rows.reduce((s, r) => s + Number(r.confidence ?? 0), 0) / total
      : 0;

    // Avg response time: created_at → updated_at for resolved tickets
    const resolvedWithTime = resolved.filter(r => r.updated_at && r.created_at);
    const avgLatencyMs = resolvedWithTime.length > 0
      ? Math.round(
          resolvedWithTime.reduce((s, r) => {
            return s + (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime());
          }, 0) / resolvedWithTime.length
        )
      : 0;

    return NextResponse.json({
      totalProcessed:  total,
      autoResolveRate: total > 0 ? Math.round((resolved.length  / total) * 100) / 100 : 0,
      escalationRate:  total > 0 ? Math.round((escalated.length / total) * 100) / 100 : 0,
      pendingCount:    pending.length,
      avgConfidence:   Math.round(avgConfidence * 100) / 100,
      avgLatencyMs,
    });
  } catch (err) {
    console.error("[analytics/overview]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
