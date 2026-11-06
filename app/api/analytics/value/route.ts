import { NextRequest, NextResponse } from "next/server";

import { estimateValue, VALUE_ASSUMPTIONS } from "@/lib/analytics/value";
import { currentUsagePeriodStart } from "@/lib/billingPlans";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/** Wat Support One deze factuurperiode opleverde: verstuurde antwoorden en de geschatte tijdwinst. */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const supabase = getSupabaseAdmin();
    const { data: tenant, error: tenantError } = await supabase.from("tenants").select("billing_period_start").eq("id", tenantId).single();
    if (tenantError) throw new Error(tenantError.message);
    const periodStart = currentUsagePeriodStart(tenant?.billing_period_start ?? null);

    // Uitgaande berichten ontstaan alleen als Support One een antwoord verstuurt (goedgekeurd of automatisch).
    const [{ count: replies, error: repliesError }, { count: autonomous, error: autoError }] = await Promise.all([
      supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "outbound").gte("sent_at", periodStart),
      supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "outbound").gte("sent_at", periodStart).eq("metadata->>reply_kind", "ai_autonomous"),
    ]);
    if (repliesError) throw new Error(repliesError.message);
    if (autoError) throw new Error(autoError.message);

    const value = estimateValue(replies ?? 0);
    return NextResponse.json({ periodStart, replies: replies ?? 0, autonomous: autonomous ?? 0, ...value, assumptions: VALUE_ASSUMPTIONS });
  } catch (err) {
    if (err instanceof Error && err.message === "Not authenticated") return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    console.error("[analytics/value]", err);
    return NextResponse.json({ error: "De opbrengst kon niet worden geladen." }, { status: 500 });
  }
}
