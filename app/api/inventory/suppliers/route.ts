import { NextResponse } from "next/server";

import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { loadInventorySettings, loadSuppliers, rebuildInventoryReport } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const NOT_READY = { error: "Leveranciers kunnen nog niet: migratie 062 is nog niet gedraaid.", notReady: true };

function notReady(error: unknown) {
  const row = error as { message?: string; code?: string } | null;
  return Boolean(row && (row.code === "42P01" || row.code === "42703" || /inventory_suppliers|product_suppliers|schema cache/i.test(row.message ?? "")));
}

/** The fields of a supplier from a request body, checked; undefined for fields not sent. */
function readSupplier(body: Record<string, unknown>, partial: boolean) {
  const row: Record<string, unknown> = {};
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) return { error: "Vul een naam in." };
    row.name = name;
  }
  if (body.email !== undefined) {
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Dat e-mailadres klopt niet." };
    row.email = email || null;
  }
  if (body.leadTimeDays !== undefined) {
    const value = body.leadTimeDays === null || body.leadTimeDays === "" ? null : Number(body.leadTimeDays);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 365)) return { error: "De levertijd moet tussen 0 en 365 dagen zijn." };
    row.lead_time_days = value;
  }
  if (body.minOrderQty !== undefined) {
    const value = body.minOrderQty === null || body.minOrderQty === "" ? 0 : Number(body.minOrderQty);
    if (!Number.isInteger(value) || value < 0 || value > 1_000_000) return { error: "De minimale bestelhoeveelheid moet een heel getal zijn." };
    row.min_order_qty = value;
  }
  if (body.note !== undefined) row.note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  return { row };
}

async function state(tenantId: string) {
  const [suppliers, settings] = await Promise.all([loadSuppliers(tenantId), loadInventorySettings(tenantId)]);
  if (!suppliers) return null;
  return { suppliers, productSuppliers: settings.productSuppliers };
}

/** GET /api/inventory/suppliers: the suppliers and which product each delivers. */
export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  try {
    const result = await state(access.context.tenantId);
    return result ? NextResponse.json(result) : NextResponse.json(NOT_READY, { status: 409 });
  } catch (error) {
    return inventoryError(error, "suppliers");
  }
}

/** POST: a new supplier { name, email?, leadTimeDays?, minOrderQty?, note? }. */
export async function POST(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const read = readSupplier(body, false);
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 });
  try {
    const { error } = await getSupabaseAdmin().from("inventory_suppliers").insert({ tenant_id: access.context.tenantId, ...read.row, created_by: access.context.userId });
    if (error) throw error;
    return NextResponse.json(await state(access.context.tenantId));
  } catch (error) {
    if (notReady(error)) return NextResponse.json(NOT_READY, { status: 409 });
    return inventoryError(error, "suppliers");
  }
}

/** PATCH: change a supplier { id, ...fields }. Lead time changes the advice, so the report is rebuilt. */
export async function PATCH(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof body.id !== "string") return NextResponse.json({ error: "Leverancier ontbreekt." }, { status: 400 });
  const read = readSupplier(body, true);
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 });
  if (!Object.keys(read.row).length) return NextResponse.json({ error: "Niets om op te slaan." }, { status: 400 });
  try {
    const { data, error } = await getSupabaseAdmin().from("inventory_suppliers").update({ ...read.row, updated_at: new Date().toISOString() })
      .eq("tenant_id", access.context.tenantId).eq("id", body.id).select("id");
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: "Deze leverancier bestaat niet meer." }, { status: 404 });
    if ("lead_time_days" in read.row) await rebuildInventoryReport(access.context.tenantId);
    return NextResponse.json(await state(access.context.tenantId));
  } catch (error) {
    if (notReady(error)) return NextResponse.json(NOT_READY, { status: 409 });
    return inventoryError(error, "suppliers");
  }
}

/** DELETE ?id=: remove a supplier; its products fall back to the shop's lead time. */
export async function DELETE(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Leverancier ontbreekt." }, { status: 400 });
  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from("inventory_suppliers").delete().eq("tenant_id", access.context.tenantId).eq("id", id);
    if (error) throw error;
    const settings = await loadInventorySettings(access.context.tenantId);
    const remaining = Object.fromEntries(Object.entries(settings.productSuppliers).filter(([, supplierId]) => supplierId !== id));
    if (Object.keys(remaining).length !== Object.keys(settings.productSuppliers).length) {
      const { error: settingsError } = await db.from("inventory_settings").update({ product_suppliers: remaining, updated_at: new Date().toISOString() }).eq("tenant_id", access.context.tenantId);
      if (settingsError) throw settingsError;
      await rebuildInventoryReport(access.context.tenantId);
    }
    return NextResponse.json(await state(access.context.tenantId));
  } catch (error) {
    if (notReady(error)) return NextResponse.json(NOT_READY, { status: 409 });
    return inventoryError(error, "suppliers");
  }
}
