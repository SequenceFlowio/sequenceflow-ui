import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getTenantPlan, PLAN_LIMITS } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { tenantId, role } = await getTenantId(req);
    const { plan, used, limit, trialEndsAt } = await getTenantPlan(tenantId);

    const docLimit = PLAN_LIMITS[plan].docs;
    const memberLimit = PLAN_LIMITS[plan].members;
    const supabase = getSupabaseAdmin();
    const [{ count: docsCount }, { count: membersCount }, { data: tenant }] = await Promise.all([
      supabase
        .from("knowledge_documents")
        .select("id", { count: "exact", head: true })
        .eq("client_id", tenantId)
        .neq("status", "error"),
      supabase
        .from("tenant_members")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("tenants")
        .select("stripe_customer_id")
        .eq("id", tenantId)
        .single(),
    ]);

    return NextResponse.json({
      plan,
      used,
      limit: limit === Infinity ? null : limit,
      trialEndsAt,
      docsUsed: docsCount ?? 0,
      docsLimit: docLimit === Infinity ? null : docLimit,
      membersUsed: membersCount ?? 0,
      membersLimit: memberLimit === Infinity ? null : memberLimit,
      billingPortalAvailable: Boolean(tenant?.stripe_customer_id),
      canManage: role === "admin",
    });
  } catch (err) {
    console.error("[billing/usage]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
