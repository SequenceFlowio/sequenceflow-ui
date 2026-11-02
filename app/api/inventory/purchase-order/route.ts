import { NextResponse } from "next/server";

import { buildPurchaseOrder, purchaseOrderCsv, purchaseOrderMail } from "@/lib/inventory/assistantCore";
import { REPORT_VERSION } from "@/lib/inventory/reportCore";
import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { loadCachedInventoryReport, loadInventorySettings, loadSuppliers, rebuildInventoryReport } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET /api/inventory/purchase-order?supplierId=&search=&lang=: the draft purchase
 * order from the current advice, with the CSV and the e-mail draft. Nothing is
 * sent or saved; the merchant downloads or copies it.
 */
export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  const url = new URL(req.url);
  const language = url.searchParams.get("lang") === "en" ? "en" : "nl";
  const supplierId = url.searchParams.get("supplierId") || null;
  const search = url.searchParams.get("search")?.slice(0, 100) || null;
  try {
    const tenantId = access.context.tenantId;
    let report = await loadCachedInventoryReport(tenantId);
    if (!report || report.version !== REPORT_VERSION) report = await rebuildInventoryReport(tenantId);
    const [suppliers, settings, { data: connection }] = await Promise.all([
      loadSuppliers(tenantId),
      loadInventorySettings(tenantId),
      getSupabaseAdmin().from("commerce_connections").select("display_name").eq("tenant_id", tenantId).eq("status", "active").order("created_at").limit(1).maybeSingle(),
    ]);
    const order = buildPurchaseOrder(report, { suppliers: suppliers ?? [], productSuppliers: settings.productSuppliers, supplierId, search, shopName: (connection?.display_name as string | null) ?? null });
    return NextResponse.json({ order, csv: purchaseOrderCsv(order), mail: purchaseOrderMail(order, language), suppliersAvailable: suppliers !== null });
  } catch (error) {
    return inventoryError(error, "purchase-order");
  }
}
