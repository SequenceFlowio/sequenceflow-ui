import { NextResponse } from "next/server";

import { verifyShopifyWebhook } from "@/lib/commerce/shopify";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const shopDomain = req.headers.get("x-shopify-shop-domain")?.toLowerCase() ?? "";
  const { data: row, error } = await getSupabaseAdmin().from("commerce_connections")
    .select("client_secret_encrypted").eq("provider", "shopify").eq("shop_domain", shopDomain).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not validate the Shopify connection." }, { status: 503 });
  if (!row || !verifyShopifyWebhook(rawBody, req.headers.get("x-shopify-hmac-sha256"), row.client_secret_encrypted)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ignored: true, reason: "provider_paused" });
}
