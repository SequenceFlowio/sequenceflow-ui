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

    // ── New AI-first conversations ──────────────────────────────────────────
    const { data: convs } = await supabase
      .from("support_conversations")
      .select("created_at, status")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    // ── Legacy tickets ──────────────────────────────────────────────────────
    const { data: legacy } = await supabase
      .from("tickets")
      .select("created_at, status")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const rows = [...(convs ?? []), ...(legacy ?? [])];

    const byDay: Record<string, { count: number; auto: number; human_review: number; pending: number }> = {};

    // Bucket definitions MUST match /api/analytics/overview so totals agree.
    //   auto         = sent | approved           (actually resolved)
    //   human_review = escalated
    //   pending      = review | open | draft | pending_autosend
    for (const row of rows) {
      if (!row.created_at) continue;
      const day = row.created_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = { count: 0, auto: 0, human_review: 0, pending: 0 };
      byDay[day].count++;
      if (["sent","approved"].includes(row.status))                               byDay[day].auto++;
      else if (row.status === "escalated")                                        byDay[day].human_review++;
      else if (["review","open","draft","pending_autosend"].includes(row.status)) byDay[day].pending++;
    }

    const result = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[analytics/volume]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
