import { NextResponse } from "next/server";

import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { parseStatusFilter, reportIsStale, reportView } from "@/lib/inventory/reportCore";
import { loadCachedInventoryReport, loadInventorySettings, rebuildInventoryReport } from "@/lib/inventory/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/inventory: summary, actions and a page of variants from the cached report. */
export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  const url = new URL(req.url);
  try {
    const tenantId = access.context.tenantId;
    let report = await loadCachedInventoryReport(tenantId);
    // No report yet (first visit) or an old format: compute one from what is stored.
    if (!report || report.version !== 1) report = await rebuildInventoryReport(tenantId);
    const settings = await loadInventorySettings(tenantId);
    return NextResponse.json({
      ...reportView(report, {
        status: parseStatusFilter(url.searchParams.get("status")),
        search: (url.searchParams.get("search") ?? "").slice(0, 100),
        channel: url.searchParams.get("channel"),
        offset: Number(url.searchParams.get("offset") ?? 0) || 0,
        limit: Number(url.searchParams.get("limit") ?? 50) || 50,
        language: url.searchParams.get("lang") === "en" ? "en" : "nl",
      }),
      stale: reportIsStale(report, new Date()),
      sync: { lastSyncedAt: settings.lastSyncedAt, lastSyncError: settings.lastSyncError, weeklyEmail: settings.weeklyEmail },
      canManage: access.context.role === "admin",
    });
  } catch (error) {
    return inventoryError(error, "overview");
  }
}
