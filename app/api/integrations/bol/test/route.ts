import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { BolAdapter, syncBolSubscriptionHealth } from "@/lib/commerce/bol";
import { loadCommerceConnection, reloadCommerceConnection } from "@/lib/commerce/connections";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let tenantId: string | null = null;
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    tenantId = context.tenantId;
    const connection = await loadCommerceConnection(context.tenantId, true, "bol");
    if (!connection) return NextResponse.json({ error: "Sla eerst de bol.com API-gegevens op." }, { status: 404 });
    const adapter = new BolAdapter();
    const result = await adapter.testConnection(connection);
    const refreshed = await reloadCommerceConnection(connection.id);
    const accountId = refreshed.externalAccountId ?? result.accountId;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const canRegisterEvents = appUrl.startsWith("https://");
    let eventsStatus: "active" | "pending" | "failed" = "failed";
    let eventsError: string | null = "Een publieke HTTPS-app-URL is nodig voor bol.com events.";
    if (canRegisterEvents) {
      try {
        await adapter.registerWebhooks(refreshed, `${appUrl}/api/integrations/bol/webhook`);
        eventsStatus = (await syncBolSubscriptionHealth(refreshed)).status;
        eventsError = null;
      } catch (error) {
        eventsError = error instanceof Error ? error.message : "bol.com events konden niet worden ingesteld.";
      }
    }
    const { error } = await getSupabaseAdmin().from("commerce_connections").update({
      display_name: result.shopName,
      external_account_id: accountId || null,
      shop_currency: "EUR",
      scopes: result.scopes,
      status: "active",
      action_mode: "disabled",
      setup_stage: eventsError ? "api" : "events",
      events_status: eventsStatus,
      last_error: eventsError,
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id).eq("tenant_id", context.tenantId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, ...result, eventsStatus, eventsError });
  } catch (error) {
    const message = error instanceof Error ? error.message : "bol.com verbinding mislukt.";
    if (tenantId) {
      await getSupabaseAdmin().from("commerce_connections").update({
        status: "failed", last_error: message.slice(0, 1000), updated_at: new Date().toISOString(),
      }).eq("tenant_id", tenantId).eq("provider", "bol");
    }
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: message }, { status: auth.status === 401 ? 401 : 400 });
  }
}
