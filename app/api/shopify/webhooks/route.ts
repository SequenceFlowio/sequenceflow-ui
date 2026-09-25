import { NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify/sessionToken";
import { encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
const topics = new Set(["app/uninstalled", "customers/data_request", "customers/redact", "shop/redact", "orders/create", "orders/updated", "orders/cancelled", "orders/fulfilled", "orders/partially_fulfilled"]);
export async function POST(req: Request) {
  const body = Buffer.from(await req.arrayBuffer());
  if (!verifyShopifyWebhook(body, req.headers.get("x-shopify-hmac-sha256") ?? "", process.env.SHOPIFY_API_SECRET ?? "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const shop = req.headers.get("x-shopify-shop-domain") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const eventId = req.headers.get("x-shopify-event-id") ?? req.headers.get("x-shopify-webhook-id");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) || !eventId || !topics.has(topic)) {
    return NextResponse.json({ error: "Invalid webhook metadata" }, { status: 400 });
  }
  try {
    JSON.parse(body.toString("utf8"));
  } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    // Durable receipt precedes acknowledgment. Privacy payloads are encrypted at rest.
    // Keep receiving uninstall/privacy notifications even if rollout is disabled.
    const db = getSupabaseAdmin();
    const { error } = await db.from("shopify_webhook_jobs").upsert({
      shop_domain: shop, topic, event_id: eventId, payload_encrypted: encryptSecret(body.toString("utf8")),
    }, { onConflict: "shop_domain,topic,event_id", ignoreDuplicates: true });
    if (error) throw error;
    if (topic === "app/uninstalled") {
      const { error: uninstallError } = await db.rpc("uninstall_shopify_installation", { p_shop: shop, p_event_id: eventId });
      if (uninstallError) throw uninstallError;
    }
    return NextResponse.json({ received: true });
  } catch {
    // Return a retryable status rather than claiming a lost event was handled.
    return NextResponse.json({ error: "Webhook could not be persisted" }, { status: 503 });
  }
}
