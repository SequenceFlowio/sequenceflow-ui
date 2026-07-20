import { NextResponse } from "next/server";

import { mapCommerceConnection } from "@/lib/commerce/connections";
import { failCommerceEvent, persistAndClaimCommerceEvent, processCommerceEvent } from "@/lib/commerce/events";
import { verifyShopifyWebhook } from "@/lib/commerce/shopify";
import { parseShopifyWebhook, shopifyWebhookEventId } from "@/lib/commerce/shopifyWebhook";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const rawBody = await req.text();
  const shopDomain = req.headers.get("x-shopify-shop-domain")?.toLowerCase() ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "unknown";
  const eventId = shopifyWebhookEventId({
    providerEventId: req.headers.get("x-shopify-event-id"), shopDomain, topic, rawBody,
  });
  const supabase = getSupabaseAdmin();
  const { data: row, error: connectionError } = await supabase.from("commerce_connections").select("*").eq("provider", "shopify").eq("shop_domain", shopDomain).maybeSingle();
  if (connectionError) return NextResponse.json({ error: "Could not validate the Shopify connection." }, { status: 503 });
  if (!row || !verifyShopifyWebhook(rawBody, req.headers.get("x-shopify-hmac-sha256"), row.client_secret_encrypted)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  const connection = mapCommerceConnection(row);
  let payload: ReturnType<typeof parseShopifyWebhook>;
  try { payload = parseShopifyWebhook(rawBody); }
  catch { return NextResponse.json({ error: "Invalid webhook JSON." }, { status: 400 }); }
  let claim;
  try {
    claim = await persistAndClaimCommerceEvent({
      tenantId: connection.tenantId,
      connectionId: connection.id,
      providerEventId: eventId,
      topic,
      eventData: payload.eventData,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Could not persist webhook event." }, { status: 503 });
  }
  if (!claim.workItem) return NextResponse.json({ ok: true, duplicate: true, state: claim.state });
  try {
    await processCommerceEvent(claim.workItem);
  } catch (processingError) {
    await failCommerceEvent(claim.workItem, processingError).catch((failureError) => {
      console.error("[shopify/webhook/failure-state]", claim.workItem?.id, failureError);
    });
    return NextResponse.json({ error: "Webhook persisted but live order refresh failed." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
