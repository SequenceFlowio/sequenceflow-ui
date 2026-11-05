import { NextResponse } from "next/server";

import { INVENTORY_PLANS, getTenantPlanAccess } from "@/lib/billing";
import { alertsUnavailable, refreshInventoryAlerts, sendInventoryAlertEmail } from "@/lib/inventory/alerts";
import { shopDay } from "@/lib/inventory/core";
import { sendWeeklyInventoryEmail } from "@/lib/inventory/email";
import { weeklyEmailDue } from "@/lib/inventory/emailCore";
import { inventoryAdviceEnabled, rebuildInventoryReport, syncInventory } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hasValidCronSecret } from "@/lib/auth/cron";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Leaves room to finish the workspace in progress before Vercel stops the function. */
const TIME_BUDGET_MS = 240_000;


/**
 * Daily: for every workspace on Scale with a connected shop, refresh catalog, sales and
 * stock, rebuild the report, let Milo check her triggers and mail what is new,
 * and on Mondays send the weekly advice to those who turned it on. Workspaces
 * with stock data but no shop (imports, the demo) get the report and triggers
 * without a sync. Does nothing while the feature flag is off.
 */
export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!inventoryAdviceEnabled()) return NextResponse.json({ ok: true, skipped: "disabled" });
  const started = Date.now();
  const db = getSupabaseAdmin();
  const [{ data: connections, error }, { data: settings, error: settingsError }] = await Promise.all([
    db.from("commerce_connections").select("tenant_id").eq("status", "active"),
    db.from("inventory_settings").select("tenant_id,last_synced_at,report_built_at,weekly_email,last_email_sent_at"),
  ]);
  if (error || settingsError) return NextResponse.json({ error: (error ?? settingsError)!.message }, { status: 500 });
  const byTenant = new Map((settings ?? []).map((row) => [row.tenant_id as string, row]));
  const today = shopDay(new Date());
  // Least recently synced first, so a long run never starves the same workspaces.
  const connected = new Set((connections ?? []).map((row) => row.tenant_id as string));
  const lastRun = (tenantId: string) => (connected.has(tenantId) ? byTenant.get(tenantId)?.last_synced_at : byTenant.get(tenantId)?.report_built_at) as string | null | undefined;
  const tenants = [...new Set([...connected, ...(settings ?? []).map((row) => row.tenant_id as string)])]
    .filter((tenantId) => !lastRun(tenantId) || shopDay(lastRun(tenantId)!) < today)
    .sort((a, b) => String(lastRun(a) ?? "").localeCompare(String(lastRun(b) ?? "")));

  const results: Array<{ tenantId: string; ok: boolean; emailed?: number; alerts?: number; alertMail?: number; error?: string; skipped?: string }> = [];
  for (const tenantId of tenants) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      // Below Scale nothing is synced or mailed; a downgrade simply stops the work.
      if (!INVENTORY_PLANS.includes((await getTenantPlanAccess(tenantId)).plan)) {
        results.push({ tenantId, ok: true, skipped: "plan" });
        continue;
      }
      const report = connected.has(tenantId) ? (await syncInventory(tenantId)).report : await rebuildInventoryReport(tenantId);
      const row = byTenant.get(tenantId);
      // Milo's triggers are a layer on top: if they fail, the sync still counts.
      let alerts: number | undefined;
      let alertMail: number | undefined;
      try {
        alerts = (await refreshInventoryAlerts(tenantId, report)).added;
        alertMail = (await sendInventoryAlertEmail(tenantId)).recipients;
      } catch (alertError) {
        if (!alertsUnavailable(alertError as { message?: string; code?: string })) console.error("[cron/inventory/alerts]", tenantId, alertError);
      }
      let emailed: number | undefined;
      if (row?.weekly_email && weeklyEmailDue(new Date(), (row.last_email_sent_at as string | null) ?? null)) {
        emailed = (await sendWeeklyInventoryEmail(tenantId, report, today)).recipients;
      }
      results.push({ tenantId, ok: true, emailed, alerts, alertMail });
    } catch (syncError) {
      results.push({ tenantId, ok: false, error: syncError instanceof Error ? syncError.message.slice(0, 300) : "failed" });
    }
  }
  return NextResponse.json({ ok: true, processed: results.length, remaining: tenants.length - results.length, results });
}
