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
      .select("intent, confidence, outcome")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    if (error) throw error;

    // Group by intent
    const byIntent: Record<string, { count: number; totalConf: number; escalated: number }> = {};

    for (const row of data ?? []) {
      const intent = row.intent ?? "unknown";
      if (!byIntent[intent]) byIntent[intent] = { count: 0, totalConf: 0, escalated: 0 };
      byIntent[intent].count++;
      byIntent[intent].totalConf += row.confidence ?? 0;
      if (row.outcome === "HUMAN_REVIEW" || row.outcome === "escalated") {
        byIntent[intent].escalated++;
      }
    }

    type Insight = {
      type: string;
      intent: string;
      count: number;
      avgConfidence: number;
      message: string;
    };

    const insights: Insight[] = [];

    for (const [intent, { count, totalConf, escalated }] of Object.entries(byIntent)) {
      const avgConf = totalConf / count;
      const escalationRate = escalated / count;

      // Low confidence intent
      if (count >= 5 && avgConf < 0.65) {
        insights.push({
          type: "low_confidence",
          intent,
          count,
          avgConfidence: Math.round(avgConf * 100) / 100,
          message: `${count} "${intent}" emails this month averaged ${Math.round(avgConf * 100)}% confidence — add a ${intent.replace(/_/g, " ")} policy document to improve accuracy.`,
        });
      }

      // High escalation rate
      if (count >= 5 && escalationRate >= 0.4) {
        insights.push({
          type: "high_escalation",
          intent,
          count,
          avgConfidence: Math.round(avgConf * 100) / 100,
          message: `${Math.round(escalationRate * 100)}% of "${intent}" emails are escalated to humans — consider adding training examples or templates for this intent.`,
        });
      }
    }

    // Sort: low_confidence first, then by count desc
    insights.sort((a, b) => {
      if (a.type !== b.type) return a.type === "low_confidence" ? -1 : 1;
      return b.count - a.count;
    });

    return NextResponse.json(insights);
  } catch (err) {
    console.error("[analytics/insights]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
