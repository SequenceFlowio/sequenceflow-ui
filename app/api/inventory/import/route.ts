import { NextResponse } from "next/server";

import { parseInventoryCsv, shopDay } from "@/lib/inventory/core";
import { importInventoryRows } from "@/lib/inventory/imports";
import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { rebuildInventoryReport } from "@/lib/inventory/sync";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 5 * 1024 * 1024;

/** POST /api/inventory/import: { kind: "sales" | "deliveries", csv } from the page's upload. */
export async function POST(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return NextResponse.json({ error: "Het bestand is groter dan 5 MB." }, { status: 413 });
  const body = await req.json().catch(() => null) as { kind?: unknown; csv?: unknown } | null;
  if (!body || (body.kind !== "sales" && body.kind !== "deliveries") || typeof body.csv !== "string") {
    return NextResponse.json({ error: "Kies een soort import en een CSV-bestand." }, { status: 400 });
  }
  if (body.csv.length > MAX_BYTES) return NextResponse.json({ error: "Het bestand is groter dan 5 MB." }, { status: 413 });
  const parsed = parseInventoryCsv(body.csv, shopDay(new Date()));
  if (!parsed.rows.length) return NextResponse.json({ error: parsed.errors[0] ?? "Geen bruikbare regels gevonden.", errors: parsed.errors }, { status: 400 });
  try {
    const result = await importInventoryRows(access.context.tenantId, body.kind, parsed.rows, access.context.userId);
    await rebuildInventoryReport(access.context.tenantId);
    return NextResponse.json({ ok: true, rows: parsed.rows.length, ...result, errors: parsed.errors });
  } catch (error) {
    return inventoryError(error, "import");
  }
}
