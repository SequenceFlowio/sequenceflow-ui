import { NextResponse } from "next/server";

import { authorizationErrorResponse } from "@/lib/auth/authorization";
import { loadCommerceConnection } from "@/lib/commerce/connections";
import { ShopifyAdapter } from "@/lib/commerce/shopify";
import { runInboundEmailPipeline } from "@/lib/pipeline/runInboundEmailPipeline";
import { getShopifyTenant } from "@/lib/shopify/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_LIMIT = 5;

/**
 * "Try an example": a realistic customer question about the store's most
 * recent order, run through the normal pipeline. New merchants (and Shopify's
 * reviewers) see a draft with the right order next to it before any mailbox
 * is connected. Limited per day because every draft costs AI.
 */
export async function POST(req: Request) {
  try {
    const context = await getShopifyTenant(req);
    const body = await req.json().catch(() => ({})) as { language?: string };
    const english = body.language === "en";
    const db = getSupabaseAdmin();

    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await db.from("support_messages").select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenantId).like("provider_message_id", "sample-%").gte("created_at", since);
    if ((count ?? 0) >= DAILY_LIMIT) {
      return NextResponse.json({ error: english ? "You can try 5 examples per day. Connect your mailbox to handle real customer questions." : "Je kunt 5 voorbeelden per dag proberen. Koppel je mailbox voor echte klantvragen." }, { status: 429 });
    }

    const connection = await loadCommerceConnection(context.tenantId, false, "shopify");
    const order = connection ? await new ShopifyAdapter().latestOrder(connection).catch(() => null) : null;
    const customerEmail = order?.customerEmail?.trim() || "example.customer@example.com";
    const reference = order?.displayName ?? "";
    const subject = english
      ? (reference ? `Where is my order ${reference}?` : "Where is my order?")
      : (reference ? `Waar blijft mijn bestelling ${reference}?` : "Waar blijft mijn bestelling?");
    const text = english
      ? `Hi, I ordered ${reference ? `order ${reference} ` : ""}a few days ago and haven't received it yet. Could you tell me when it will arrive?\n\nThanks!`
      : `Hoi, ik heb ${reference ? `bestelling ${reference} ` : ""}een paar dagen geleden geplaatst en nog niets ontvangen. Kunnen jullie laten weten wanneer het binnenkomt?\n\nAlvast bedankt!`;
    const now = new Date().toISOString();
    const id = `sample-${crypto.randomUUID()}`;

    const result = await runInboundEmailPipeline({
      tenantId: context.tenantId,
      email: {
        provider: "resend",
        providerMessageId: id,
        recipient: "support@example.com",
        from: { email: customerEmail, name: english ? "Example customer" : "Voorbeeldklant" },
        to: ["support@example.com"],
        cc: [],
        bcc: [],
        subject,
        text,
        headers: { "x-sequenceflow-sample": "1" },
        internetMessageId: `<${id}@sample.sequenceflow.io>`,
        receivedAt: now,
      },
    });
    const conversationId = (result as { conversationId?: string } | null)?.conversationId ?? null;
    return NextResponse.json({ ok: true, conversationId, order: reference || null });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth.status === 401 || auth.status === 403) return NextResponse.json({ error: auth.message }, { status: auth.status });
    console.error("[shopify/sample]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Het voorbeeld kon niet worden gemaakt. Probeer het opnieuw." }, { status: 502 });
  }
}
