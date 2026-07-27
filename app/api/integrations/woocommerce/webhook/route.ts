import { NextResponse } from "next/server";

import { verifyWooCommerceWebhook } from "@/lib/commerce/woocommerce";
import { normalizeWooCommerceUrl } from "@/lib/commerce/woocommerceHttp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  let source: string;
  try {
    source = normalizeWooCommerceUrl(req.headers.get("x-wc-webhook-source") || "");
  } catch {
    return NextResponse.json({ error: "Invalid webhook source." }, { status: 401 });
  }
  const { data: row, error } = await getSupabaseAdmin().from("commerce_connections")
    .select("access_token_encrypted").eq("provider", "woocommerce").eq("shop_domain", source).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not validate the WooCommerce connection." }, { status: 503 });
  if (!row?.access_token_encrypted || !verifyWooCommerceWebhook(rawBody, req.headers.get("x-wc-webhook-signature"), row.access_token_encrypted)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ignored: true, reason: "provider_paused" });
}
