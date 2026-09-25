import { NextResponse } from "next/server";
import { authenticateShopify } from "@/lib/shopify/authenticate";
import { getShopifyOfflineAccess } from "@/lib/shopify/installations";
import { loadCommerceConnection } from "@/lib/commerce/connections";
import { ShopifyAdapter } from "@/lib/commerce/shopify";
import { upsertCommerceOrder } from "@/lib/commerce/repository";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const identity = await authenticateShopify(req);
    if (identity.role !== "admin") return NextResponse.json({ error: "Alleen de winkeleigenaar kan synchroniseren." }, { status: 403 });
    const { tenantId } = await getShopifyOfflineAccess(identity.shop);
    if (!tenantId) return NextResponse.json({ error: "Kies eerst een werkruimte voor deze winkel." }, { status: 409 });
    const connection = await loadCommerceConnection(tenantId, false, "shopify");
    if (!connection || connection.shopDomain !== identity.shop) throw new Error("Shopify connection unavailable");
    const orders = await new ShopifyAdapter().syncRecentOrders(connection, new Date(Date.now() - 60 * 86400000).toISOString());
    for (const order of orders) await upsertCommerceOrder(connection, order);
    const { error } = await getSupabaseAdmin().from("commerce_connections").update({ last_synced_at: new Date().toISOString() }).eq("id", connection.id).eq("tenant_id", tenantId);
    if (error) throw error;
    return NextResponse.json({ synced: orders.length });
  } catch {
    return NextResponse.json({ error: "Synchroniseren is niet gelukt. Controleer de Shopify-verbinding en probeer opnieuw." }, { status: 503 });
  }
}
