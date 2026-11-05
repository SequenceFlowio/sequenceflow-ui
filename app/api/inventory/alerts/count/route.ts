import { NextResponse } from "next/server";

import { INVENTORY_PLANS, getTenantPlanAccess } from "@/lib/billing";
import { inventoryAdviceEnabled } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/** GET /api/inventory/alerts/count: how many of Otis's alerts are open, for the sidebar. Never an error: 0 when it does not apply. */
export async function GET(req: Request) {
  if (!inventoryAdviceEnabled()) return NextResponse.json({ open: 0 });
  try {
    const context = await getTenantId(req);
    const { plan } = await getTenantPlanAccess(context.tenantId);
    if (!INVENTORY_PLANS.includes(plan)) return NextResponse.json({ open: 0 });
    const { count, error } = await getSupabaseAdmin().from("inventory_alerts").select("id", { count: "exact", head: true }).eq("tenant_id", context.tenantId).is("resolved_at", null);
    return NextResponse.json({ open: error ? 0 : count ?? 0 });
  } catch {
    return NextResponse.json({ open: 0 });
  }
}
