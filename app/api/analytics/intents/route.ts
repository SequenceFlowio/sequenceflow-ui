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

    // ── New AI-first: decisions joined via conversations ────────────────────
    const { data: convs } = await supabase
      .from("support_conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    const convIds = (convs ?? []).map(c => c.id);

    const { data: decisions } = convIds.length > 0
      ? await supabase
          .from("support_decisions")
          .select("intent, confidence")
          .in("conversation_id", convIds)
      : { data: [] as { intent: string | null; confidence: number | null }[] };

    // ── Legacy tickets ──────────────────────────────────────────────────────
    const { data: legacy } = await supabase
      .from("tickets")
      .select("intent, confidence")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    const rows = [
      ...(decisions ?? []),
      ...(legacy ?? []),
    ];

    const byIntent: Record<string, { count: number; totalConf: number }> = {};

    for (const row of rows) {
      const intent = row.intent ?? "fallback";
      if (!byIntent[intent]) byIntent[intent] = { count: 0, totalConf: 0 };
      byIntent[intent].count++;
      byIntent[intent].totalConf += Number(row.confidence ?? 0);
    }

    const result = Object.entries(byIntent)
      .map(([intent, { count, totalConf }]) => ({
        intent,
        label: (intent === "fallback" || intent === "unknown")
          ? "Overig"
          : intent.replace(/_/g, " "),
        count,
        avgConfidence: Math.round((totalConf / count) * 100) / 100,
      }))
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
