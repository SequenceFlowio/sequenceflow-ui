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
      .select("created_at, status")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const byDay: Record<string, { count: number; auto: number; human_review: number }> = {};

    for (const row of data ?? []) {
      const day = row.created_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = { count: 0, auto: 0, human_review: 0 };
      byDay[day].count++;
      if (row.status === "sent" || row.status === "approved" || row.status === "pending_autosend") byDay[day].auto++;
      else if (row.status === "escalated")                    byDay[day].human_review++;
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
