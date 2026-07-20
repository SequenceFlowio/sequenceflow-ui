import { NextResponse } from "next/server";

import { recordCommerceAudit } from "@/lib/commerce/audit";
import { reloadCommerceConnection } from "@/lib/commerce/connections";
import { commerceAdapterFor } from "@/lib/commerce/adapter";
import { isVerifiedOrderCandidate } from "@/lib/commerce/identity";
import { loadConversationCommerce } from "@/lib/commerce/resolution";
import { loadOrderContext, upsertCommerceOrder } from "@/lib/commerce/repository";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

function commerceContextError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "Not authenticated" ? 401 : message === "Tenant not found for user" ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

async function conversationFor(req: Request, id: string) {
  const context = await getTenantId(req);
  const { data } = await getSupabaseAdmin().from("support_conversations").select("id,customer_email")
    .eq("id", id).eq("tenant_id", context.tenantId).maybeSingle();
  return { context, conversation: data };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { context, conversation } = await conversationFor(req, id);
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ commerceContext: await loadConversationCommerce({ tenantId: context.tenantId, conversationId: id, customerEmail: conversation.customer_email }) });
  } catch (error) {
    return commerceContextError(error, "Could not load commerce context.");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { context, conversation } = await conversationFor(req, id);
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const body = await req.json().catch(() => ({})) as { orderId?: unknown };
    const orderId = String(body.orderId ?? "");
    const current = await loadConversationCommerce({ tenantId: context.tenantId, conversationId: id, customerEmail: conversation.customer_email });
    if (!isVerifiedOrderCandidate((current?.candidates ?? []).map((candidate) => candidate.id), orderId)) {
      return NextResponse.json({ error: "Order is not a verified candidate for this conversation." }, { status: 422 });
    }
    const order = await loadOrderContext(context.tenantId, orderId);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "order_link_requested",
      targetType: "order_link", targetId: orderId, metadata: { conversationId: id, matchMethod: "manual" },
    });
    const { error: linkError } = await getSupabaseAdmin().rpc("confirm_conversation_order_link", {
      p_tenant_id: context.tenantId,
      p_conversation_id: id,
      p_order_id: orderId,
      p_user_id: context.userId,
    });
    if (linkError) throw new Error(`Could not confirm the order link: ${linkError.message}`);
    return NextResponse.json({ ok: true, order: await loadOrderContext(context.tenantId, orderId, { method: "manual", confidence: 1 }) });
  } catch (error) {
    return commerceContextError(error, "Could not link order.");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { context, conversation } = await conversationFor(req, id);
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const commerce = await loadConversationCommerce({ tenantId: context.tenantId, conversationId: id, customerEmail: conversation.customer_email });
    if (!commerce?.order) return NextResponse.json({ error: "Link an order first." }, { status: 409 });
    const connection = await reloadCommerceConnection(commerce.order.connectionId);
    if (connection.tenantId !== context.tenantId || connection.status !== "active") return NextResponse.json({ error: "Commerce connection unavailable." }, { status: 409 });
    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "order_refresh_requested",
      targetType: "order_link", targetId: commerce.order.id, metadata: { conversationId: id },
    });
    const live = await commerceAdapterFor(connection).getOrder(connection, commerce.order.externalId);
    if (!live) return NextResponse.json({ error: "Order no longer exists." }, { status: 404 });
    await upsertCommerceOrder(connection, live);
    return NextResponse.json({ ok: true, order: await loadOrderContext(context.tenantId, commerce.order.id, { method: commerce.order.matchMethod, confidence: commerce.order.matchConfidence }) });
  } catch (error) {
    return commerceContextError(error, "Could not refresh order.");
  }
}
