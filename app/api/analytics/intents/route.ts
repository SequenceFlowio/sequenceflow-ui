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
      .select("intent, confidence")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    if (error) throw error;

    const byIntent: Record<string, { count: number; totalConf: number }> = {};

    for (const row of data ?? []) {
      const intent = row.intent ?? "fallback";
      if (!byIntent[intent]) byIntent[intent] = { count: 0, totalConf: 0 };
      byIntent[intent].count++;
      byIntent[intent].totalConf += Number(row.confidence ?? 0);
    }

    const result = Object.entries(byIntent)
      .map(([intent, { count, totalConf }]) => ({
        intent,
        // Display label: map "fallback"/"unknown" → "Overig", replace underscores
        label: (intent === "fallback" || intent === "unknown")
          ? "Overig"
          : intent.replace(/_/g, " "),
        count,
        avgConfidence: Math.round((totalConf / count) * 100) / 100,
      }))
      // Sort by count desc, "fallback"/"unknown" always last
      .sort((a, b) => {
        const aFallback = a.intent === "fallback" || a.intent === "unknown";
        const bFallback = b.intent === "fallback" || b.intent === "unknown";
        if (aFallback && !bFallback) return 1;
        if (!aFallback && bFallback) return -1;
        return b.count - a.count;
      })
      .slice(0, 8);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[analytics/intents]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
