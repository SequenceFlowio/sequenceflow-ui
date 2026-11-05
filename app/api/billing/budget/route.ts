import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/** Het maandbudget voor het gebruiksdeel instellen (in centen) of weghalen (null). Alleen beheerders. */
export async function PATCH(req: NextRequest) {
  try {
    const { tenantId, role } = await getTenantId(req);
    if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const { budgetCents } = await req.json();
    const value = budgetCents === null ? null : Number(budgetCents);
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 10_000_000)) {
      return NextResponse.json({ error: "Invalid budget" }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from("tenants").update({ usage_budget_cents: value }).eq("id", tenantId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, budgetCents: value });
  } catch (err) {
    if (err instanceof Error && err.message === "Not authenticated") return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    console.error("[billing/budget]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
