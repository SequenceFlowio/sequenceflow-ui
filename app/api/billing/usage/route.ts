import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getTenantPlan, PLAN_LIMITS } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan, used, limit, trialEndsAt } = await getTenantPlan(tenantId);

    const docLimit = PLAN_LIMITS[plan].docs;
    let docsUsed = 0;

    if (docLimit !== Infinity) {
      const supabase = getSupabaseAdmin();
      const { count } = await supabase
        .from("knowledge_documents")
        .select("id", { count: "exact", head: true })
        .eq("client_id", tenantId)
        .neq("status", "error");
      docsUsed = count ?? 0;
    }

    return NextResponse.json({
      plan,
      used,
      limit,
      trialEndsAt,
      docsUsed,
      docsLimit: docLimit === Infinity ? null : docLimit,
    });
  } catch (err) {
    console.error("[billing/usage]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
