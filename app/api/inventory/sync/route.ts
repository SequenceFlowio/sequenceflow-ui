import { NextResponse } from "next/server";

import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { loadInventorySettings, syncInventory } from "@/lib/inventory/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

const MIN_INTERVAL_MS = 2 * 60 * 1000;

/** POST /api/inventory/sync: fetch catalog, sales and stock now (admins, at most every 2 minutes). */
export async function POST(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  try {
    const settings = await loadInventorySettings(access.context.tenantId);
    if (settings.lastSyncedAt && Date.now() - Date.parse(settings.lastSyncedAt) < MIN_INTERVAL_MS) {
      return NextResponse.json({ error: "Net bijgewerkt. Probeer het over een paar minuten opnieuw." }, { status: 429 });
    }
    const result = await syncInventory(access.context.tenantId);
    return NextResponse.json({
      ok: true,
      connections: result.connections,
      salesRows: result.salesRows,
      stockRows: result.stockRows,
      deliveries: result.deliveries,
      builtAt: result.report.builtAt,
    });
  } catch (error) {
    return inventoryError(error, "sync");
  }
}
