import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getTenantPlan } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan, used, limit, trialEndsAt } = await getTenantPlan(tenantId);
    return NextResponse.json({ plan, used, limit, trialEndsAt });
  } catch (err) {
    console.error("[billing/usage]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
