import { createVariantResolver, type ImportKind, type ImportRow } from "@/lib/inventory/core";
import { fetchAll } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Sales history and deliveries the merchant uploads (CSV) or types in. Sales
 * land in the 'import' channel, so a re-import of the same file replaces
 * itself instead of doubling up.
 */

async function resolver(tenantId: string) {
  const db = getSupabaseAdmin();
  const data = await fetchAll<{ provider: string; external_id: string; variant_key: string; sku: string | null; ean: string | null }>((from, to) => db.from("inventory_variants")
    .select("provider,external_id,variant_key,sku,ean").eq("tenant_id", tenantId).order("id").range(from, to));
  return createVariantResolver(data.map((row) => ({ variantKey: row.variant_key, provider: row.provider, externalId: row.external_id, sku: row.sku, ean: row.ean })));
}

export async function importInventoryRows(tenantId: string, kind: ImportKind, rows: ImportRow[], userId: string | null, options: { source?: "import" | "manual"; note?: string | null } = {}) {
  const resolve = await resolver(tenantId);
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  if (kind === "sales") {
    const totals = new Map<string, { variant_key: string; day: string; units_sold: number; revenue: number; orders: number }>();
    for (const row of rows) {
      const variantKey = resolve({ provider: "import", sku: row.sku, ean: row.ean });
      const id = `${variantKey}\u0000${row.day}`;
      const total = totals.get(id) ?? { variant_key: variantKey, day: row.day, units_sold: 0, revenue: 0, orders: 0 };
      total.units_sold += row.quantity;
      total.revenue = Math.round((total.revenue + (row.amount ?? 0)) * 100) / 100;
      total.orders += 1;
      totals.set(id, total);
    }
    const values = [...totals.values()].map((total) => ({ tenant_id: tenantId, channel: "import", updated_at: now, ...total }));
    for (let start = 0; start < values.length; start += 1000) {
      const { error } = await db.from("inventory_daily_sales").upsert(values.slice(start, start + 1000), { onConflict: "tenant_id,variant_key,day,channel" });
      if (error) throw new Error(`Could not save the sales history: ${error.message}`);
    }
    return { saved: values.length, variants: new Set(values.map((value) => value.variant_key)).size };
  }

  const deliveries = new Map<string, { variant_key: string; received_on: string; quantity: number; unit_cost: number | null }>();
  for (const row of rows) {
    const variantKey = resolve({ provider: "import", sku: row.sku, ean: row.ean });
    const id = `${variantKey}\u0000${row.day}`;
    const delivery = deliveries.get(id) ?? { variant_key: variantKey, received_on: row.day, quantity: 0, unit_cost: row.amount };
    delivery.quantity += row.quantity;
    deliveries.set(id, delivery);
  }
  const values = [...deliveries.values()].map((delivery) => ({ tenant_id: tenantId, source: options.source ?? "import", note: options.note || null, created_by: userId, ...delivery }));
  for (let start = 0; start < values.length; start += 1000) {
    const { error } = await db.from("inventory_deliveries").upsert(values.slice(start, start + 1000), { onConflict: "tenant_id,variant_key,received_on,source" });
    if (error) throw new Error(`Could not save the deliveries: ${error.message}`);
  }
  return { saved: values.length, variants: new Set(values.map((value) => value.variant_key)).size };
}
