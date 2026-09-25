import { NextResponse } from "next/server";

import { authorizationErrorResponse } from "@/lib/auth/authorization";
import { loadCommerceConnection } from "@/lib/commerce/connections";
import { upsertCommerceOrder } from "@/lib/commerce/repository";
import { ShopifyAdapter } from "@/lib/commerce/shopify";
import { authenticateShopify } from "@/lib/shopify/authenticate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 30;

async function shopConnection(req: Request) {
  const identity = await authenticateShopify(req);
  const { data: install, error } = await getSupabaseAdmin().from("shopify_installations")
    .select("tenant_id,status").eq("shop_domain", identity.shop).maybeSingle();
  if (error) throw new Error("Could not load Shopify installation");
  if (!install?.tenant_id || install.status !== "active") return { identity, connection: null };
  const connection = await loadCommerceConnection(String(install.tenant_id), true, "shopify");
  return { identity, connection: connection?.shopDomain === identity.shop ? connection : null };
}

/** Status for onboarding: order context counts as active only after a successful test. */
export async function GET(req: Request) {
  try {
    const { connection } = await shopConnection(req);
    if (!connection) return NextResponse.json({ connected: false });
    return NextResponse.json({
      connected: true,
      tested: connection.setupStage === "complete",
      lastError: connection.lastError,
      lastSyncedAt: connection.lastSyncedAt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}

/** Run the test: read the newest order the way Support One will during a customer question. */
export async function POST(req: Request) {
  let connectionId: string | null = null;
  let tenantId: string | null = null;
  try {
    const { identity, connection } = await shopConnection(req);
    if (identity.role !== "admin") return NextResponse.json({ error: "Alleen de winkeleigenaar kan dit testen." }, { status: 403 });
    if (!connection) return NextResponse.json({ error: "Kies eerst een werkruimte voor deze winkel." }, { status: 409 });
    connectionId = connection.id;
    tenantId = connection.tenantId;
    const adapter = new ShopifyAdapter();
    const { shopName } = await adapter.testConnection(connection);
    const order = await adapter.latestOrder(connection);
    if (order) await upsertCommerceOrder(connection, order);
    const now = new Date().toISOString();
    const { error } = await getSupabaseAdmin().from("commerce_connections")
      .update({ setup_stage: "complete", last_error: null, display_name: shopName, updated_at: now })
      .eq("id", connection.id).eq("tenant_id", connection.tenantId);
    if (error) throw error;
    return NextResponse.json({ ok: true, shopName, latestOrder: order?.displayName ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    // Protected customer fields fail until Shopify approved the access request.
    const friendly = /protected|customer data|access denied|not approved/i.test(message)
      ? "Shopify geeft de klantgegevens van bestellingen nog niet vrij. Controleer in het Partner-dashboard of de toegang tot beschermde klantgegevens is goedgekeurd."
      : "De test is niet gelukt. Open de app opnieuw vanuit Shopify en probeer het nog eens.";
    if (connectionId && tenantId) {
      await getSupabaseAdmin().from("commerce_connections").update({ last_error: friendly, updated_at: new Date().toISOString() })
        .eq("id", connectionId).eq("tenant_id", tenantId);
    }
    const auth = authorizationErrorResponse(error);
    if (auth.status === 401) return NextResponse.json({ error: auth.message }, { status: 401 });
    console.error("[shopify/order-context]", message);
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
