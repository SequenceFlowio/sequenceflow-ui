import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { mapCommerceConnection } from "@/lib/commerce/connections";
import { failCommerceEvent, persistAndClaimCommerceEvent, processCommerceEvent } from "@/lib/commerce/events";
import { verifyWooCommerceWebhook, wooGmtTimestamp } from "@/lib/commerce/woocommerce";
import { normalizeWooCommerceUrl } from "@/lib/commerce/woocommerceHttp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
export const runtime = "nodejs"; export const maxDuration = 60;
export async function POST(req: Request) {
  const rawBody = await req.text(); const topic = req.headers.get("x-wc-webhook-topic") || "unknown";
  let source: string; try { source = normalizeWooCommerceUrl(req.headers.get("x-wc-webhook-source") || ""); } catch { return NextResponse.json({ error: "Invalid webhook source." }, { status: 401 }); }
  const supabase = getSupabaseAdmin(); const { data: row, error: connectionError } = await supabase.from("commerce_connections").select("*").eq("provider", "woocommerce").eq("shop_domain", source).maybeSingle();
  if (connectionError) return NextResponse.json({ error: "Could not validate the WooCommerce connection." }, { status: 503 });
  if (!row?.access_token_encrypted || !verifyWooCommerceWebhook(rawBody, req.headers.get("x-wc-webhook-signature"), row.access_token_encrypted)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  const connection = mapCommerceConnection(row); let payload: { id?: number; date_modified_gmt?: string };
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!Number.isSafeInteger(payload.id) || Number(payload.id) <= 0) return NextResponse.json({ error: "Webhook order id is missing or invalid." }, { status: 400 });
  const eventId = req.headers.get("x-wc-webhook-delivery-id") || createHash("sha256").update(`${source}:${topic}:${rawBody}`).digest("hex");
  let claim;
  try {
    claim = await persistAndClaimCommerceEvent({ tenantId: connection.tenantId, connectionId: connection.id, providerEventId: eventId, topic, eventData: { externalOrderId: String(payload.id) }, occurredAt: wooGmtTimestamp(payload.date_modified_gmt) ?? new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Could not persist webhook." }, { status: 503 });
  }
  if (!claim.workItem) return NextResponse.json({ ok: true, duplicate: true, state: claim.state });
  try {
    await processCommerceEvent(claim.workItem);
    return NextResponse.json({ ok: true });
  } catch (webhookError) {
    await failCommerceEvent(claim.workItem, webhookError).catch((failureError) => {
      console.error("[woocommerce/webhook/failure-state]", claim.workItem?.id, failureError);
    });
    return NextResponse.json({ error: "Webhook persisted but refresh failed." }, { status: 503 });
  }
}
