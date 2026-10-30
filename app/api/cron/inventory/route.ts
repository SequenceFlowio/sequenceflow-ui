import { NextResponse } from "next/server";

import { INVENTORY_PLANS, getTenantPlanAccess } from "@/lib/billing";
import { shopDay } from "@/lib/inventory/core";
import { sendWeeklyInventoryEmail } from "@/lib/inventory/email";
import { weeklyEmailDue } from "@/lib/inventory/emailCore";
import { inventoryAdviceEnabled, syncInventory } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Leaves room to finish the workspace in progress before Vercel stops the function. */
const TIME_BUDGET_MS = 240_000;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

/**
 * Daily: for every workspace on Scale with a connected shop, refresh catalog, sales and
 * stock, rebuild the report, and on Mondays send the weekly advice to those
 * who turned it on. Does nothing while the feature flag is off.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!inventoryAdviceEnabled()) return NextResponse.json({ ok: true, skipped: "disabled" });
  const started = Date.now();
  const db = getSupabaseAdmin();
  const [{ data: connections, error }, { data: settings, error: settingsError }] = await Promise.all([
    db.from("commerce_connections").select("tenant_id").eq("status", "active"),
    db.from("inventory_settings").select("tenant_id,last_synced_at,weekly_email,last_email_sent_at"),
  ]);
  if (error || settingsError) return NextResponse.json({ error: (error ?? settingsError)!.message }, { status: 500 });
  const byTenant = new Map((settings ?? []).map((row) => [row.tenant_id as string, row]));
  const today = shopDay(new Date());
  // Least recently synced first, so a long run never starves the same workspaces.
  const tenants = [...new Set((connections ?? []).map((row) => row.tenant_id as string))]
    .filter((tenantId) => !byTenant.get(tenantId)?.last_synced_at || shopDay(byTenant.get(tenantId)!.last_synced_at as string) < today)
    .sort((a, b) => String(byTenant.get(a)?.last_synced_at ?? "").localeCompare(String(byTenant.get(b)?.last_synced_at ?? "")));

  const results: Array<{ tenantId: string; ok: boolean; emailed?: number; error?: string; skipped?: string }> = [];
  for (const tenantId of tenants) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      // Below Scale nothing is synced or mailed; a downgrade simply stops the work.
      if (!INVENTORY_PLANS.includes((await getTenantPlanAccess(tenantId)).plan)) {
        results.push({ tenantId, ok: true, skipped: "plan" });
        continue;
      }
      const { report } = await syncInventory(tenantId);
      const row = byTenant.get(tenantId);
      let emailed: number | undefined;
      if (row?.weekly_email && weeklyEmailDue(new Date(), (row.last_email_sent_at as string | null) ?? null)) {
        emailed = (await sendWeeklyInventoryEmail(tenantId, report, today)).recipients;
      }
      results.push({ tenantId, ok: true, emailed });
    } catch (syncError) {
      results.push({ tenantId, ok: false, error: syncError instanceof Error ? syncError.message.slice(0, 300) : "failed" });
    }
  }
  return NextResponse.json({ ok: true, processed: results.length, remaining: tenants.length - results.length, results });
}
