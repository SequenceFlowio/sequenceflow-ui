import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { recordCommerceAudit } from "@/lib/commerce/audit";
import { commerceConfigurationIssue } from "@/lib/commerce/configuration";
import { loadCommerceConnection } from "@/lib/commerce/connections";
import { ShopifyAdapter, reloadConnection } from "@/lib/commerce/shopify";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let tenantId: string | null = null;
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    tenantId = context.tenantId;
    const connection = await loadCommerceConnection(context.tenantId, true, "shopify");
    if (!connection) return NextResponse.json({ error: "Save the Shopify connection first." }, { status: 404 });
    const configurationIssue = commerceConfigurationIssue();
    if (configurationIssue) return NextResponse.json({ error: configurationIssue }, { status: 409 });
    const callbackBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    if (!callbackBase.startsWith("https://")) {
      return NextResponse.json({ error: "A public HTTPS app URL is required before Shopify webhooks can be registered." }, { status: 409 });
    }
    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "connection_test_requested",
      targetType: "connection", targetId: connection.id, metadata: { provider: "shopify", shopDomain: connection.shopDomain },
    });
    const adapter = new ShopifyAdapter();
    const result = await adapter.testConnection(connection);
    const supabase = getSupabaseAdmin();
    const { error: detailsError } = await supabase.from("commerce_connections").update({
      display_name: result.shopName, shop_currency: result.currencyCode, scopes: result.scopes,
      last_error: null, updated_at: new Date().toISOString(),
    }).eq("id", connection.id).eq("tenant_id", context.tenantId);
    if (detailsError) throw new Error(`Could not persist the Shopify connection test: ${detailsError.message}`);
    await adapter.registerWebhooks(await reloadConnection(connection.id), `${callbackBase}/api/integrations/shopify/webhook`);
    const { error: activeError } = await supabase.from("commerce_connections").update({
      status: "active", last_error: null, updated_at: new Date().toISOString(),
    }).eq("id", connection.id).eq("tenant_id", context.tenantId);
    if (activeError) throw new Error(`Could not activate the Shopify connection: ${activeError.message}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shopify connection failed.";
    if (tenantId) {
      const { error: failureError } = await getSupabaseAdmin().from("commerce_connections").update({ status: "failed", last_error: message, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("provider", "shopify");
      if (failureError) console.error("[shopify/test] Could not persist failed status:", failureError.message);
    }
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: message }, { status: auth.status === 401 ? 401 : 400 });
  }
}
