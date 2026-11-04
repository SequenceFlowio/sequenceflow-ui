import { NextResponse } from "next/server";

import { processShopifyWebhookJobs } from "@/lib/shopify/webhookJobs";
import { hasValidCronSecret } from "@/lib/auth/cron";

export const runtime = "nodejs";
export const maxDuration = 60;


/** Every minute: order updates and Shopify's privacy requests. */
async function handler(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.SHOPIFY_PUBLIC_APP_ENABLED !== "true") return NextResponse.json({ skipped: "disabled" });
  try {
    return NextResponse.json(await processShopifyWebhookJobs());
  } catch (error) {
    console.error("[cron/shopify-webhooks]", error);
    return NextResponse.json({ error: "Shopify webhook processing failed" }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
