import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { recordCommerceAudit } from "@/lib/commerce/audit";
import { loadCommerceConnection } from "@/lib/commerce/connections";
import { upsertCommerceOrder } from "@/lib/commerce/repository";
import { WooCommerceAdapter } from "@/lib/commerce/woocommerce";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
export const runtime = "nodejs"; export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]); const connection = await loadCommerceConnection(context.tenantId, false, "woocommerce");
    if (!connection) return NextResponse.json({ error: "Active WooCommerce connection required." }, { status: 409 });
    await recordCommerceAudit({ tenantId: context.tenantId, actorUserId: context.userId, eventType: "order_sync_requested", targetType: "connection", targetId: connection.id, metadata: { provider: "woocommerce", lookbackDays: 30 } });
    const since = new Date(Date.now() - 30 * 86400000).toISOString(); const orders = await new WooCommerceAdapter().syncRecentOrders(connection, since);
    for (const order of orders) await upsertCommerceOrder(connection, order);
    const now = new Date().toISOString(); const { error: syncStateError } = await getSupabaseAdmin().from("commerce_connections").update({ last_synced_at: now, last_error: null, updated_at: now }).eq("id", connection.id).eq("tenant_id", context.tenantId);
    if (syncStateError) throw new Error(`Could not finalize the WooCommerce sync: ${syncStateError.message}`);
    return NextResponse.json({ ok: true, processed: orders.length, syncedAt: now });
  } catch (error) { const auth = authorizationErrorResponse(error); return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status: auth.status === 401 ? 401 : 400 }); }
}
