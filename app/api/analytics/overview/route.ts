import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantPlan, ANALYTICS_PLANS } from "@/lib/billing";

export const runtime = "nodejs";

const isSent      = (s: string) => s === "sent"      || s === "approved";
const isEscalated = (s: string) => s === "escalated";
const isPending   = (s: string) => ["review","open","draft","pending_autosend"].includes(s);

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
      .select("id, status, created_at, latest_message_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    const convIds = (convs ?? []).map(c => c.id);

    const { data: decisions } = convIds.length > 0
      ? await supabase
          .from("support_decisions")
          .select("conversation_id, confidence")
          .in("conversation_id", convIds)
      : { data: [] as { conversation_id: string; confidence: number | null }[] };

    const confMap = new Map((decisions ?? []).map(d => [d.conversation_id, d.confidence]));

    const newRows = (convs ?? []).map(c => ({
      status:     c.status as string,
      confidence: confMap.get(c.id) ?? null as number | null,
      created_at: c.created_at as string,
      updated_at: (c.latest_message_at ?? c.created_at) as string,
    }));

    // ── Legacy tickets ──────────────────────────────────────────────────────
    const { data: legacy } = await supabase
      .from("tickets")
      .select("status, confidence, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    const rows = [...newRows, ...(legacy ?? [])];

    // ── Aggregate ───────────────────────────────────────────────────────────
    const total     = rows.length;
    const resolved  = rows.filter(r => isSent(r.status));
    const escalated = rows.filter(r => isEscalated(r.status));
    const pending   = rows.filter(r => isPending(r.status));

    const avgConfidence = total > 0
      ? rows.reduce((s, r) => s + Number(r.confidence ?? 0), 0) / total
      : 0;

    const resolvedWithTime = resolved.filter(r => r.updated_at && r.created_at);
    const avgLatencyMs = resolvedWithTime.length > 0
      ? Math.round(
          resolvedWithTime.reduce((s, r) =>
            s + (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()), 0
          ) / resolvedWithTime.length
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
