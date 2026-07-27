import { extractOrderNumbers, customerKey, orderCustomerIdentityMatches, selectOrdersMatchingReferences } from "@/lib/commerce/identity";
import { loadCommerceConnection, reloadCommerceConnection } from "@/lib/commerce/connections";
import { commerceAdapterFor } from "@/lib/commerce/adapter";
import { loadOrderContext, upsertCommerceOrder } from "@/lib/commerce/repository";
import type { CommerceOrderContext } from "@/lib/commerce/types";
import type { CommerceProvider } from "@/lib/commerce/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extractBolOrderReferences, isRecognizedBolMail } from "@/lib/commerce/bolMail";
import { persistBolOrderContext } from "@/lib/commerce/bol";
import { isCommerceProviderRuntimeEnabled } from "@/lib/commerce/providers";

export type CommerceResolution = {
  provider: CommerceProvider;
  connectionStatus: "active" | "paused" | "failed" | "test_required";
  actionMode: "disabled" | "approval_required";
  order: CommerceOrderContext | null;
  candidates: CommerceOrderContext[];
};

async function recordResolutionOutcome(input: {
  tenantId: string;
  conversationId: string;
  orderId?: string | null;
  outcome: "commerce_context_matched" | "commerce_context_ambiguous" | "commerce_context_unmatched";
  metadata: Record<string, unknown>;
}) {
  const { error } = await getSupabaseAdmin().from("operational_outcomes").insert({
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    order_id: input.orderId ?? null,
    outcome_type: input.outcome,
    metadata: input.metadata,
  });
  if (error) console.error("[commerce-resolution/outcome]", error.message);
}

export async function resolveCommerceForInbound(input: {
  tenantId: string;
  conversationId: string;
  customerEmail: string;
  subject: string;
  body: string;
  from: string;
  replyTo?: string | null;
  headers?: Record<string, string> | null;
}) {
  const connection = await loadCommerceConnection(input.tenantId).catch(() => null);
  if (!connection) return null;
  const supabase = getSupabaseAdmin();
  const { data: confirmedLink, error: confirmedLinkError } = await supabase
    .from("conversation_entity_links")
    .select("order_id")
    .eq("tenant_id", input.tenantId)
    .eq("conversation_id", input.conversationId)
    .eq("link_status", "linked")
    .eq("match_method", "manual")
    .not("confirmed_at", "is", null)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (confirmedLinkError) throw new Error(`Could not inspect the confirmed order link: ${confirmedLinkError.message}`);
  if (confirmedLink?.order_id) {
    const storedOrder = await loadOrderContext(input.tenantId, confirmedLink.order_id, { method: "manual", confidence: 1 });
    if (!storedOrder) throw new Error("The manually confirmed order no longer exists in the commerce cache.");
    const linkedConnection = storedOrder.connectionId === connection.id
      ? connection
      : await reloadCommerceConnection(storedOrder.connectionId);
    if (linkedConnection.tenantId !== input.tenantId) throw new Error("The manually confirmed order belongs to another tenant.");
    if (linkedConnection.status !== "active" || !isCommerceProviderRuntimeEnabled(linkedConnection.provider)) return null;
    const liveOrder = await commerceAdapterFor(linkedConnection).getOrder(linkedConnection, storedOrder.externalId);
    if (!liveOrder) throw new Error("The manually confirmed order no longer exists at the commerce provider.");
    const refreshedOrderId = linkedConnection.provider === "bol"
      ? await persistBolOrderContext(linkedConnection, liveOrder)
      : await upsertCommerceOrder(linkedConnection, liveOrder);
    const refreshedOrder = await loadOrderContext(input.tenantId, refreshedOrderId, { method: "manual", confidence: 1 });
    if (!refreshedOrder) throw new Error("Could not reload the manually confirmed order.");
    await recordResolutionOutcome({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      orderId: refreshedOrder.id,
      outcome: "commerce_context_matched",
      metadata: { matchMethod: "manual", confidence: 1, humanConfirmed: true },
    });
    return {
      provider: linkedConnection.provider,
      connectionStatus: linkedConnection.status,
      actionMode: linkedConnection.actionMode,
      order: refreshedOrder,
      candidates: [refreshedOrder],
    } satisfies CommerceResolution;
  }
  const adapter = commerceAdapterFor(connection);
  const recognizedBolMail = connection.provider === "bol" && isRecognizedBolMail({
    from: input.from,
    replyTo: input.replyTo,
    subject: input.subject,
    headers: input.headers,
  });
  const orderNumbers = connection.provider === "bol"
    ? extractBolOrderReferences(input.subject, input.body)
    : extractOrderNumbers(`${input.subject}\n${input.body}`);
  let matchedByOrderNumber = orderNumbers.length > 0;
  let liveOrders = orderNumbers.length
    ? (await Promise.all(orderNumbers.map((orderNumber) => adapter.findOrders(connection, { orderNumber })))).flat()
    : connection.provider === "bol" ? [] : await adapter.findOrders(connection, { email: input.customerEmail });
  liveOrders = Array.from(new Map(liveOrders.map((order) => [order.externalId, order])).values());
  if (matchedByOrderNumber && liveOrders.length === 0 && connection.provider !== "bol") {
    liveOrders = await adapter.findOrders(connection, { email: input.customerEmail });
    matchedByOrderNumber = false;
  }
  const matchMethod = matchedByOrderNumber ? "order_number" as const : "customer_email" as const;
  const synced: Array<{ id: string; displayName: string; customerIdentityMatched: boolean }> = [];
  for (const order of liveOrders) {
    const id = connection.provider === "bol"
      ? await persistBolOrderContext(connection, order)
      : await upsertCommerceOrder(connection, order);
    synced.push({
      id,
      displayName: order.displayName,
      customerIdentityMatched: orderCustomerIdentityMatches(order.customerEmail, input.customerEmail),
    });
  }

  const exact = matchedByOrderNumber
    ? selectOrdersMatchingReferences(synced, orderNumbers)
    : synced;
  const candidates = await Promise.all(exact.map((order) => loadOrderContext(input.tenantId, order.id, {
    method: matchMethod,
    confidence: matchMethod === "order_number" ? 1 : exact.length === 1 ? 0.9 : 0.55,
  })));
  const validCandidates = candidates.filter((candidate): candidate is CommerceOrderContext => Boolean(candidate));
  const selectedCandidate = validCandidates.length === 1
    ? exact.find((candidate) => candidate.id === validCandidates[0].id)
    : null;
  const autoLinkAllowed = validCandidates.length === 1
    && (connection.provider === "bol"
      ? recognizedBolMail && matchedByOrderNumber && orderNumbers.length === 1
      : (!matchedByOrderNumber || selectedCandidate?.customerIdentityMatched === true));
  if (!autoLinkAllowed) {
    await supabase.from("conversation_entity_links").delete()
      .eq("tenant_id", input.tenantId).eq("conversation_id", input.conversationId).eq("link_status", "candidate");
    for (const candidate of validCandidates) {
      await supabase.from("conversation_entity_links").upsert({
        tenant_id: input.tenantId,
        conversation_id: input.conversationId,
        order_id: candidate.id,
        link_status: "candidate",
        match_method: matchMethod,
        confidence: matchedByOrderNumber && !exact.find((order) => order.id === candidate.id)?.customerIdentityMatched
          ? 0.6
          : candidate.matchConfidence,
        evidence: matchMethod === "order_number"
          ? {
              orderNumbers,
              bolMailVerified: recognizedBolMail,
              customerIdentityMatched: exact.find((order) => order.id === candidate.id)?.customerIdentityMatched === true,
            }
          : { customerKey: customerKey(input.tenantId, input.customerEmail) },
      }, { onConflict: "conversation_id,order_id" });
    }
    await recordResolutionOutcome({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      outcome: validCandidates.length ? "commerce_context_ambiguous" : "commerce_context_unmatched",
      metadata: {
        matchMethod,
        candidateCount: validCandidates.length,
        explicitReferenceCount: orderNumbers.length,
        customerIdentityMatched: selectedCandidate?.customerIdentityMatched === true,
      },
    });
    return { provider: connection.provider, connectionStatus: connection.status, actionMode: connection.actionMode, order: null, candidates: validCandidates } satisfies CommerceResolution;
  }

  const order = validCandidates[0];
  await supabase.from("conversation_entity_links").delete()
    .eq("tenant_id", input.tenantId).eq("conversation_id", input.conversationId).eq("link_status", "candidate");
  await supabase.from("conversation_entity_links").upsert({
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    order_id: order.id,
    link_status: "linked",
    match_method: matchMethod,
    confidence: order.matchConfidence,
    evidence: matchMethod === "order_number"
      ? { orderNumber: orderNumbers[0], customerIdentityMatched: connection.provider === "bol" ? null : true, bolMailVerified: recognizedBolMail }
      : { customerKey: customerKey(input.tenantId, input.customerEmail) },
  }, { onConflict: "conversation_id,order_id" });
  await recordResolutionOutcome({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    orderId: order.id,
    outcome: "commerce_context_matched",
    metadata: { matchMethod, confidence: order.matchConfidence, explicitReferenceCount: orderNumbers.length },
  });
  if (connection.provider === "bol" && recognizedBolMail && !connection.mailboxVerifiedAt) {
    const now = new Date().toISOString();
    await supabase.from("commerce_connections").update({
      mailbox_verified_at: now,
      setup_stage: connection.eventsStatus === "active" ? "complete" : "events",
      updated_at: now,
    }).eq("id", connection.id).eq("tenant_id", input.tenantId);
  }
  return { provider: connection.provider, connectionStatus: connection.status, actionMode: connection.actionMode, order, candidates: validCandidates } satisfies CommerceResolution;
}

export async function loadConversationCommerce(input: { tenantId: string; conversationId: string; customerEmail: string }) {
  const defaultConnection = await loadCommerceConnection(input.tenantId, false).catch(() => null);
  if (!defaultConnection) return null;
  const supabase = getSupabaseAdmin();
  const { data: links } = await supabase.from("conversation_entity_links")
    .select("order_id, link_status, match_method, confidence, confirmed_at")
    .eq("tenant_id", input.tenantId).eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: false });
  const primary = links?.find((link) => link.link_status === "linked");
  let order = primary ? await loadOrderContext(input.tenantId, primary.order_id, {
    method: primary.match_method as CommerceOrderContext["matchMethod"], confidence: Number(primary.confidence),
  }) : null;
  const connection = order && order.connectionId !== defaultConnection.id
    ? await reloadCommerceConnection(order.connectionId).catch(() => defaultConnection)
    : defaultConnection;
  if (connection.status !== "active" || !isCommerceProviderRuntimeEnabled(connection.provider)) {
    return {
      provider: defaultConnection.provider,
      connectionStatus: defaultConnection.status,
      actionMode: defaultConnection.actionMode,
      order: null,
      candidates: [],
    } satisfies CommerceResolution;
  }
  if (order && Date.now() - Date.parse(order.lastSyncedAt) > 5 * 60_000) {
    const live = await commerceAdapterFor(connection).getOrder(connection, order.externalId);
    if (live) {
      const refreshedId = connection.provider === "bol"
        ? await persistBolOrderContext(connection, live)
        : await upsertCommerceOrder(connection, live);
      order = await loadOrderContext(input.tenantId, refreshedId, {
        method: order.matchMethod,
        confidence: order.matchConfidence,
      });
    }
  }
  const candidateRows = connection.provider === "bol"
    ? []
    : (await supabase.from("commerce_orders")
      .select("id").eq("tenant_id", input.tenantId)
      .eq("connection_id", connection.id)
      .eq("customer_key", customerKey(input.tenantId, input.customerEmail))
      .order("order_created_at", { ascending: false }).limit(10)).data ?? [];
  const candidateIds = [...new Set([
    ...(links ?? []).filter((link) => link.link_status === "candidate").map((link) => link.order_id),
    ...candidateRows.map((row) => row.id),
  ])];
  const candidates = (await Promise.all(candidateIds.map((id) => loadOrderContext(input.tenantId, id))))
    .filter((candidate): candidate is CommerceOrderContext => candidate !== null && candidate.connectionId === connection.id);
  return { provider: connection.provider, connectionStatus: connection.status, actionMode: connection.actionMode, order, candidates } satisfies CommerceResolution;
}

export function buildCommercePromptContext(resolution: CommerceResolution | null) {
  if (!resolution) return "";
  if (!resolution?.order) {
    return resolution?.candidates.length
      ? "COMMERCE CONTEXT\nMultiple orders match this customer. Ask for the order number. Do not claim an action was taken."
      : "COMMERCE CONTEXT\nNo verified commerce order is linked. Never claim shipping, refund, or cancellation facts.";
  }
  const order = resolution.order;
  const items = order.items.map((item) => `${item.quantity}x ${item.title}${item.sku ? ` (SKU ${item.sku})` : ""}`).join(", ");
  const tracking = order.fulfillments.map((item) => [item.status, item.trackingCompany, item.trackingNumber].filter(Boolean).join(" / ")).filter(Boolean).join(", ");
  const returns = order.returns.flatMap((item) => item.items.map((returnItem) =>
    `${returnItem.title ?? returnItem.ean ?? "item"}: ${returnItem.handled ? "processed" : "registered"}${returnItem.handlingResult ? ` (${returnItem.handlingResult})` : ""}`)).join(", ");
  const offers = order.offers.map((item) =>
    `${item.ean ?? item.externalId}: stock ${item.stockAmount ?? "unknown"}, for sale ${item.forSale === null ? "unknown" : item.forSale ? "yes" : "no"}`).join(", ");
  return `COMMERCE CONTEXT — LIVE SOURCE OF TRUTH
- Order: ${order.displayName}
- Financial status: ${order.financialStatus ?? "unknown"}
- Fulfillment status: ${order.fulfillmentStatus ?? "unknown"}
- Amount: ${order.totalAmount} ${order.currencyCode}
- Cancelable pre-check: ${order.cancelable ? "yes" : "no"}
- Items: ${items || "not loaded"}
- Fulfillment/tracking: ${tracking || "none"}
- Returns: ${returns || "none registered"}
- Relevant offer/stock: ${offers || "not loaded"}
- Last synced: ${order.lastSyncedAt}
- actionsAllowed: ${resolution.provider === "bol" ? "false (read-only bol.com v1)" : resolution.actionMode === "approval_required" ? "human approval required" : "false"}

Live commerce facts override profile, policy, historical examples, and inference. ${resolution.provider !== "bol" && resolution.actionMode === "approval_required" && order.cancelable ? `If the customer explicitly requests cancellation, return requires_human=true and actions=[{"type":"cancel_order","payload":{"orderId":"${order.id}"}}].` : "Do not propose a commerce action."} Never say a return, shipment, refund, or cancellation was performed unless live provider status proves it.`;
}
