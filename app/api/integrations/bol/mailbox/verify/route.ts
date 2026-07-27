import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { BolAdapter } from "@/lib/commerce/bol";
import { extractBolOrderReferences, isRecognizedBolMail } from "@/lib/commerce/bolMail";
import { loadCommerceConnection } from "@/lib/commerce/connections";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const connection = await loadCommerceConnection(context.tenantId, true, "bol");
    if (!connection || connection.status !== "active") {
      return NextResponse.json({ error: "Maak eerst de bol.com API-koppeling actief." }, { status: 409 });
    }
    const { data: messages, error } = await getSupabaseAdmin().from("support_messages")
      .select("conversation_id,from_email,reply_to_email,internet_message_id,subject_original,body_original,metadata")
      .eq("tenant_id", context.tenantId)
      .eq("direction", "inbound")
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const matched = (messages ?? []).map((message) => {
      const headers = message.metadata && typeof message.metadata === "object" && "headers" in message.metadata
        ? message.metadata.headers as Record<string, string> : {};
      const references = extractBolOrderReferences(message.subject_original, message.body_original);
      const recognized = isRecognizedBolMail({
        from: message.from_email,
        replyTo: message.reply_to_email,
        subject: message.subject_original,
        headers,
      });
      return { ...message, references, recognized };
    }).find((message) =>
      message.recognized
      && message.references.length === 1
      && Boolean(message.reply_to_email || message.from_email)
      && Boolean(message.internet_message_id));
    if (!matched) {
      return NextResponse.json({
        error: "Nog geen replybare bol.com klantvraag met één ordernummer en geldige thread gevonden.",
      }, { status: 409 });
    }
    const liveOrders = await new BolAdapter().findOrders(connection, { orderNumber: matched.references[0] });
    if (liveOrders.length !== 1 || liveOrders[0].externalId !== matched.references[0]) {
      return NextResponse.json({ error: "De order uit de bol.com klantvraag kon niet live worden bevestigd." }, { status: 409 });
    }
    const { data: storedOrder, error: orderError } = await getSupabaseAdmin().from("commerce_orders")
      .select("id")
      .eq("tenant_id", context.tenantId)
      .eq("connection_id", connection.id)
      .eq("provider", "bol")
      .eq("external_id", matched.references[0])
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!storedOrder) {
      return NextResponse.json({ error: "De live bol.com order is nog niet aan deze werkruimte gekoppeld." }, { status: 409 });
    }
    const { data: entityLink, error: linkError } = await getSupabaseAdmin().from("conversation_entity_links")
      .select("id")
      .eq("tenant_id", context.tenantId)
      .eq("conversation_id", matched.conversation_id)
      .eq("order_id", storedOrder.id)
      .eq("link_status", "linked")
      .maybeSingle();
    if (linkError) throw new Error(linkError.message);
    if (!entityLink) {
      return NextResponse.json({ error: "De bol.com klantvraag is nog niet eenduidig aan de live order gekoppeld." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const { error: updateError } = await getSupabaseAdmin().from("commerce_connections").update({
      mailbox_verified_at: now,
      setup_stage: connection.eventsStatus === "active" ? "complete" : "events",
      updated_at: now,
    }).eq("id", connection.id).eq("tenant_id", context.tenantId);
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ ok: true, mailboxVerifiedAt: now });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status: auth.status });
  }
}
