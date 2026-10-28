import { NextResponse } from "next/server";

import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { loadInventorySettings, rebuildInventoryReport } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const LIMITS = {
  leadTimeDays: { column: "lead_time_days", min: 0, max: 365, integer: true },
  coverWeeks: { column: "cover_weeks", min: 1, max: 52, integer: true },
  safetyBuffer: { column: "safety_buffer", min: 0, max: 2, integer: false },
  deadAfterDays: { column: "dead_after_days", min: 14, max: 730, integer: true },
  deadCoverWeeks: { column: "dead_cover_weeks", min: 4, max: 156, integer: true },
} as const;

export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  try {
    return NextResponse.json({ settings: await loadInventorySettings(access.context.tenantId) });
  } catch (error) {
    return inventoryError(error, "settings");
  }
}

/** PATCH /api/inventory/settings: how this shop buys, and the weekly mail. Only the fields sent change. */
export async function PATCH(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const [field, limit] of Object.entries(LIMITS)) {
    if (body[field] === undefined) continue;
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < limit.min || value > limit.max || (limit.integer && !Number.isInteger(value))) {
      return NextResponse.json({ error: `Ongeldige waarde voor ${field} (${limit.min} tot ${limit.max}).` }, { status: 400 });
    }
    update[limit.column] = value;
  }
  if (body.weeklyEmail !== undefined) {
    if (typeof body.weeklyEmail !== "boolean") return NextResponse.json({ error: "Ongeldige waarde voor weeklyEmail." }, { status: 400 });
    update.weekly_email = body.weeklyEmail;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Niets om op te slaan." }, { status: 400 });
  try {
    const { error } = await getSupabaseAdmin().from("inventory_settings")
      .upsert({ tenant_id: access.context.tenantId, ...update, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
    if (error) throw new Error(error.message);
    // Thresholds change the advice; the mail toggle does not.
    if (Object.keys(update).some((key) => key !== "weekly_email")) await rebuildInventoryReport(access.context.tenantId);
    return NextResponse.json({ ok: true, settings: await loadInventorySettings(access.context.tenantId) });
  } catch (error) {
    return inventoryError(error, "settings");
  }
}
