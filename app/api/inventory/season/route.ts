import { NextResponse } from "next/server";

import { addDays, daysBetween, isDay, shopDay } from "@/lib/inventory/core";
import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { loadSeasonReport } from "@/lib/inventory/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/inventory/season?from=2026-11-01&to=2026-12-31: what sold in that period last year. */
export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  const url = new URL(req.url);
  const today = shopDay(new Date());
  const from = url.searchParams.get("from") ?? today;
  const to = url.searchParams.get("to") ?? addDays(from, 90);
  if (!isDay(from) || !isDay(to) || to < from || daysBetween(from, to) > 366) {
    return NextResponse.json({ error: "Kies een periode van maximaal een jaar." }, { status: 400 });
  }
  try {
    return NextResponse.json(await loadSeasonReport(access.context.tenantId, from, to));
  } catch (error) {
    return inventoryError(error, "season");
  }
}
