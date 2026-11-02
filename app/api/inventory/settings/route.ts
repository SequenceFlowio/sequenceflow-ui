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
  // One product's season: months 1–12 it mainly sells in, [] for all year, null to detect it again.
  if (body.productSeason !== undefined) {
    const season = body.productSeason as { productKey?: unknown; months?: unknown } | null;
    const productKey = typeof season?.productKey === "string" ? season.productKey : "";
    const months = season?.months;
    const validMonths = months === null || (Array.isArray(months) && months.length <= 12
      && months.every((month) => Number.isInteger(month) && month >= 1 && month <= 12) && new Set(months).size === months.length);
    if (!productKey || productKey.length > 400 || !validMonths) return NextResponse.json({ error: "Ongeldig seizoen." }, { status: 400 });
    try {
      const seasons = { ...(await loadInventorySettings(access.context.tenantId)).productSeasons };
      if (months === null) delete seasons[productKey];
      else seasons[productKey] = [...(months as number[])].sort((a, b) => a - b);
      update.product_seasons = seasons;
    } catch (error) {
      return inventoryError(error, "settings");
    }
  }
  if (body.alertEmail !== undefined) {
    if (typeof body.alertEmail !== "boolean") return NextResponse.json({ error: "Ongeldige waarde voor alertEmail." }, { status: 400 });
    update.alert_email = body.alertEmail;
  }
  if (body.weeklyEmail !== undefined) {
    if (typeof body.weeklyEmail !== "boolean") return NextResponse.json({ error: "Ongeldige waarde voor weeklyEmail." }, { status: 400 });
    update.weekly_email = body.weeklyEmail;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Niets om op te slaan." }, { status: 400 });
  try {
    const { error } = await getSupabaseAdmin().from("inventory_settings")
      .upsert({ tenant_id: access.context.tenantId, ...update, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
    if (error) {
      if (/alert_email/.test(error.message)) return NextResponse.json({ error: "Vera's mails instellen kan nog niet: migratie 061 is nog niet gedraaid." }, { status: 409 });
      if (/product_seasons/.test(error.message)) return NextResponse.json({ error: "Seizoenen opslaan kan nog niet: migratie 060 is nog niet gedraaid." }, { status: 409 });
      throw new Error(error.message);
    }
    // Thresholds and seasons change the advice; the mail toggle does not.
    if (Object.keys(update).some((key) => key !== "weekly_email" && key !== "alert_email")) await rebuildInventoryReport(access.context.tenantId);
    return NextResponse.json({ ok: true, settings: await loadInventorySettings(access.context.tenantId) });
  } catch (error) {
    return inventoryError(error, "settings");
  }
}
