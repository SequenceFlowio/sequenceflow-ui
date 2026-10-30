import { NextResponse } from "next/server";

import { addDays, isDay, normalizeEan, normalizeSku, shopDay } from "@/lib/inventory/core";
import { importInventoryRows } from "@/lib/inventory/imports";
import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { rebuildInventoryReport } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** POST /api/inventory/deliveries: one delivery by hand ({ code, day, quantity, note }); a future day means "on its way". */
export async function POST(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as { code?: unknown; day?: unknown; quantity?: unknown; note?: unknown };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const ean = normalizeEan(code);
  const sku = ean ? null : normalizeSku(code);
  const quantity = Number(body.quantity);
  const today = shopDay(new Date());
  if (!sku && !ean) return NextResponse.json({ error: "Vul een SKU of EAN in." }, { status: 400 });
  if (!isDay(body.day) || body.day > addDays(today, 366)) return NextResponse.json({ error: "Kies een geldige datum." }, { status: 400 });
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1_000_000) return NextResponse.json({ error: "Het aantal moet een heel getal boven 0 zijn." }, { status: 400 });
  try {
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
    await importInventoryRows(access.context.tenantId, "deliveries", [{ day: body.day, sku, ean, quantity, amount: null }], access.context.userId, { source: "manual", note });
    await rebuildInventoryReport(access.context.tenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return inventoryError(error, "deliveries");
  }
}

/** DELETE /api/inventory/deliveries?id=…: remove an entered or imported delivery (detected ones come back from stock). */
export async function DELETE(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Onbekende levering." }, { status: 400 });
  try {
    const { data, error } = await getSupabaseAdmin().from("inventory_deliveries").delete()
      .eq("tenant_id", access.context.tenantId).eq("id", id).neq("source", "detected").select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return NextResponse.json({ error: "Deze levering kan niet verwijderd worden." }, { status: 404 });
    await rebuildInventoryReport(access.context.tenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return inventoryError(error, "deliveries");
  }
}
