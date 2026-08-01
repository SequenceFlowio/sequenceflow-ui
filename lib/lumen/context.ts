import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildLumenSuggestions } from "@/lib/lumen/chat";
import type { LumenSnapshot, LumenSource } from "@/lib/lumen/types";

const PERIOD_DAYS = 30 as const;

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function countBy<T>(items: T[], value: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = value(item)?.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key, "nl"));
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function source(input: LumenSource) {
  return input;
}

function unavailableSource(id: string, label: string) {
  return source({ id, label, detail: "Tijdelijk niet beschikbaar", status: "unavailable" });
}

export async function loadLumenSnapshot(
  tenantId: string,
  language: "nl" | "en" = "nl",
): Promise<LumenSnapshot> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [
    conversationResult,
    autosendResult,
    painPointResult,
    commerceConnectionResult,
    commerceBriefingResult,
    commerceOrderResult,
    knowledgeResult,
    profileResult,
    profileFactsResult,
  ] = await Promise.all([
    supabase.from("support_conversations")
      .select("id,status,latest_decision_id,created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since) as unknown as Promise<QueryResult<Array<{
        id: string;
        status: string;
        latest_decision_id: string | null;
        created_at: string;
      }>>>,
    supabase.from("support_events")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("outcome", "autosend_sent")
      .gte("created_at", since) as unknown as Promise<QueryResult<Array<{ id: string }>>>,
    supabase.from("pain_point_analyses")
      .select("intro,pain_points,ticket_count,generated_at")
      .eq("tenant_id", tenantId)
      .eq("period", "monthly")
      .eq("analysis_version", 2)
      .maybeSingle() as unknown as Promise<QueryResult<{
        intro: string;
        pain_points: unknown;
        ticket_count: number;
        generated_at: string;
      }>>,
    supabase.from("commerce_connections")
      .select("id,status,last_synced_at")
      .eq("tenant_id", tenantId)
      .eq("provider", "bol")
      .maybeSingle() as unknown as Promise<QueryResult<{
        id: string;
        status: string;
        last_synced_at: string | null;
      }>>,
    supabase.from("commerce_intelligence_briefings")
      .select("source_counts,signals,briefing,generated_at")
      .eq("tenant_id", tenantId)
      .eq("period_days", PERIOD_DAYS)
      .maybeSingle() as unknown as Promise<QueryResult<{
        source_counts: Record<string, unknown>;
        signals: unknown;
        briefing: unknown;
        generated_at: string;
      }>>,
    supabase.from("commerce_orders")
      .select("id,fulfillment_status")
      .eq("tenant_id", tenantId)
      .eq("provider", "bol")
      .gte("order_created_at", since) as unknown as Promise<QueryResult<Array<{
        id: string;
        fulfillment_status: string | null;
      }>>>,
    supabase.from("knowledge_documents")
      .select("status,doc_type")
      .eq("client_id", tenantId) as unknown as Promise<QueryResult<Array<{
        status: string;
        doc_type: string | null;
      }>>>,
    supabase.from("tenant_agent_profile")
      .select("status,updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle() as unknown as Promise<QueryResult<{
        status: string;
        updated_at: string;
      }>>,
    supabase.from("tenant_profile_facts")
      .select("kind,status")
      .eq("tenant_id", tenantId) as unknown as Promise<QueryResult<Array<{
        kind: string;
        status: string;
      }>>>,
  ]);

  const sources: LumenSource[] = [];
  let support: LumenSnapshot["support"] = null;
  const conversations = conversationResult.data ?? [];
  if (conversationResult.error) {
    sources.push(unavailableSource("support-30d", language === "nl" ? "Klantcontact" : "Customer support"));
  } else {
    const decisionIds = conversations
      .map((conversation) => conversation.latest_decision_id)
      .filter((id): id is string => Boolean(id));
    const decisionResult = decisionIds.length
      ? await supabase.from("support_decisions")
          .select("id,intent,confidence")
          .eq("tenant_id", tenantId)
          .in("id", decisionIds) as unknown as QueryResult<Array<{
            id: string;
            intent: string;
            confidence: number | string | null;
          }>>
      : { data: [], error: null };
    const decisions = decisionResult.data ?? [];
    const confidences = decisions
      .map((decision) => numberOrNull(decision.confidence))
      .filter((confidence): confidence is number => confidence !== null);
    const statuses = countBy(conversations, (conversation) => conversation.status);
    const statusCount = (status: string) => statuses.find((row) => row.key === status)?.count ?? 0;
    support = {
      conversations: conversations.length,
      sent: statusCount("sent") + statusCount("closed"),
      review: statusCount("review") + statusCount("open") + statusCount("pending_autosend"),
      escalated: statusCount("escalated"),
      spam: statusCount("spam"),
      autoSent: autosendResult.error ? 0 : autosendResult.data?.length ?? 0,
      averageConfidence: confidences.length
        ? Math.round((confidences.reduce((sum, value) => sum + value, 0) / confidences.length) * 100) / 100
        : null,
      confidenceSampleSize: confidences.length,
      topIntents: countBy(decisions, (decision) => decision.intent)
        .slice(0, 8)
        .map(({ key, count }) => ({ intent: key, count })),
    };
    sources.push(source({
      id: "support-30d",
      label: language === "nl" ? "Klantcontact" : "Customer support",
      detail: conversations.length
        ? `${conversations.length} ${language === "nl" ? "gesprekken in 30 dagen" : "conversations in 30 days"}`
        : language === "nl" ? "Nog geen gesprekken" : "No conversations yet",
      status: conversations.length ? "ready" : "empty",
    }));
  }

  let painPoints: LumenSnapshot["painPoints"] = null;
  if (painPointResult.error) {
    sources.push(unavailableSource("pain-points", language === "nl" ? "Klantpijnpunten" : "Customer pain points"));
  } else {
    const rawPoints = Array.isArray(painPointResult.data?.pain_points) ? painPointResult.data.pain_points : [];
    painPoints = painPointResult.data ? {
      intro: String(painPointResult.data.intro ?? ""),
      ticketCount: Number(painPointResult.data.ticket_count ?? 0),
      items: rawPoints.slice(0, 7).flatMap((value) => {
        const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
        const category = typeof row.category === "string" ? row.category : "";
        if (!category) return [];
        return [{
          category,
          count: Number(row.count ?? 0),
          percentage: Number(row.percentage ?? 0),
          description: String(row.description ?? ""),
          recommendedAction: String(row.recommended_action ?? ""),
        }];
      }),
    } : null;
    sources.push(source({
      id: "pain-points",
      label: language === "nl" ? "Klantpijnpunten" : "Customer pain points",
      detail: painPoints?.items.length
        ? `${painPoints.items.length} ${language === "nl" ? "betrouwbare patronen" : "reliable patterns"}`
        : language === "nl" ? "Nog geen analyse" : "No analysis yet",
      status: painPoints?.items.length ? "ready" : "empty",
      updatedAt: painPointResult.data?.generated_at ?? null,
    }));
  }

  let commerce: LumenSnapshot["commerce"] = null;
  if (commerceConnectionResult.error || commerceOrderResult.error) {
    sources.push(unavailableSource("commerce-30d", "Commerce"));
  } else {
    const connection = commerceConnectionResult.data;
    const orders = commerceOrderResult.data ?? [];
    const orderIds = orders.map((order) => order.id);
    const emptyResult = { data: [], error: null };
    const [itemsResult, returnsResult, offersResult, shipmentsResult] = orderIds.length
      ? await Promise.all([
          supabase.from("commerce_order_items")
            .select("order_id,title,quantity,ean,offer_external_id")
            .eq("tenant_id", tenantId)
            .in("order_id", orderIds),
          supabase.from("commerce_return_items")
            .select("order_id,title,ean,expected_quantity,handled_quantity")
            .eq("tenant_id", tenantId)
            .in("order_id", orderIds),
          supabase.from("commerce_offer_snapshots")
            .select("external_id,ean,stock_amount,corrected_stock,last_synced_at")
            .eq("tenant_id", tenantId)
            .in("order_id", orderIds)
            .order("last_synced_at", { ascending: false }),
          supabase.from("commerce_fulfillments")
            .select("tracking_number,transport_status_description,latest_transport_event_at")
            .eq("tenant_id", tenantId)
            .in("order_id", orderIds),
        ])
      : [emptyResult, emptyResult, emptyResult, emptyResult];

    const itemRows = itemsResult.error ? [] : itemsResult.data ?? [];
    const returnRows = returnsResult.error ? [] : returnsResult.data ?? [];
    const offerRows = offersResult.error ? [] : offersResult.data ?? [];
    const shipmentRows = shipmentsResult.error ? [] : shipmentsResult.data ?? [];
    const productByKey = new Map<string, {
      title: string;
      orderedUnits: number;
      returnedUnits: number;
      stock: number | null;
    }>();
    const productKey = (row: { ean?: string | null; offer_external_id?: string | null; title?: string | null }) =>
      row.ean || row.offer_external_id || row.title || "unknown";
    for (const item of itemRows) {
      const key = productKey(item);
      const current = productByKey.get(key) ?? {
        title: String(item.title || item.ean || "Onbekend artikel"),
        orderedUnits: 0,
        returnedUnits: 0,
        stock: null,
      };
      current.orderedUnits += Math.max(0, Number(item.quantity ?? 0));
      productByKey.set(key, current);
    }
    for (const item of returnRows) {
      const key = productKey(item);
      const current = productByKey.get(key) ?? {
        title: String(item.title || item.ean || "Onbekend artikel"),
        orderedUnits: 0,
        returnedUnits: 0,
        stock: null,
      };
      current.returnedUnits += Math.max(0, Number(item.handled_quantity ?? item.expected_quantity ?? 0));
      productByKey.set(key, current);
    }
    const latestOffers = new Map<string, typeof offerRows[number]>();
    for (const offer of offerRows) {
      const key = String(offer.ean || offer.external_id || "unknown");
      if (!latestOffers.has(key)) latestOffers.set(key, offer);
    }
    for (const [key, offer] of latestOffers) {
      const product = productByKey.get(key);
      if (!product) continue;
      product.stock = numberOrNull(offer.corrected_stock ?? offer.stock_amount);
    }

    const briefing = commerceBriefingResult.data?.briefing;
    const briefingObject = briefing && typeof briefing === "object" ? briefing as Record<string, unknown> : {};
    const rawSignals = Array.isArray(commerceBriefingResult.data?.signals)
      ? commerceBriefingResult.data.signals
      : [];
    const topProducts = [...productByKey.values()]
      .sort((left, right) =>
        (right.returnedUnits - left.returnedUnits)
        || (right.orderedUnits - left.orderedUnits)
        || left.title.localeCompare(right.title, "nl"))
      .slice(0, 10);
    commerce = {
      connected: Boolean(connection),
      connectionStatus: connection?.status ?? null,
      orders: orders.length,
      openOrders: orders.filter((order) =>
        !["SHIPPED", "CANCELLED"].includes(String(order.fulfillment_status ?? "").toUpperCase())).length,
      products: productByKey.size,
      lowStock: topProducts.filter((product) => product.stock !== null && product.stock <= 5).length,
      activeReturns: returnRows.filter((item) => Number(item.handled_quantity ?? 0) < Number(item.expected_quantity ?? 0)).length,
      shipmentsWithoutTransportEvent: shipmentRows.filter((shipment) =>
        Boolean(shipment.tracking_number)
        && !shipment.transport_status_description
        && !shipment.latest_transport_event_at).length,
      coverage: commerceBriefingResult.data?.source_counts ?? null,
      summary: typeof briefingObject.summary === "string" ? briefingObject.summary : null,
      signals: rawSignals.slice(0, 8).flatMap((value) => {
        const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
        if (typeof row.title !== "string") return [];
        return [{
          id: String(row.id ?? ""),
          severity: String(row.severity ?? "attention"),
          title: row.title,
          finding: String(row.finding ?? ""),
          recommendedAction: String(row.recommendedAction ?? row.recommended_action ?? ""),
          sample: Number(row.sample ?? 0),
        }];
      }),
      topProducts,
    };
    sources.push(source({
      id: "commerce-30d",
      label: "bol.com Commerce",
      detail: connection
        ? `${orders.length} ${language === "nl" ? "orders in 30 dagen" : "orders in 30 days"}`
        : language === "nl" ? "Niet gekoppeld" : "Not connected",
      status: connection ? (orders.length ? "ready" : "empty") : "empty",
      updatedAt: connection?.last_synced_at ?? commerceBriefingResult.data?.generated_at ?? null,
    }));
  }

  let knowledge: LumenSnapshot["knowledge"] = null;
  if (knowledgeResult.error) {
    sources.push(unavailableSource("knowledge", language === "nl" ? "Kennisbank" : "Knowledge base"));
  } else {
    const documents = knowledgeResult.data ?? [];
    const ready = documents.filter((document) => document.status === "ready").length;
    const processing = documents.filter((document) => ["queued", "processing"].includes(document.status)).length;
    const attention = documents.filter((document) => document.status === "error").length;
    knowledge = {
      ready,
      processing,
      attention,
      categories: countBy(documents, (document) => document.doc_type ?? "general")
        .map(({ key, count }) => ({ category: key, count })),
    };
    sources.push(source({
      id: "knowledge",
      label: language === "nl" ? "Kennisbank" : "Knowledge base",
      detail: ready
        ? `${ready} ${language === "nl" ? "bronnen gereed" : "sources ready"}`
        : language === "nl" ? "Nog geen bronnen" : "No sources yet",
      status: ready ? "ready" : "empty",
    }));
  }

  let agentProfile: LumenSnapshot["agentProfile"] = null;
  if (profileResult.error || profileFactsResult.error) {
    sources.push(unavailableSource("agent-profile", "Agent DNA"));
  } else {
    const facts = profileFactsResult.data ?? [];
    const approved = facts.filter((fact) => fact.status === "approved");
    agentProfile = {
      active: profileResult.data?.status === "active",
      approvedFacts: approved.length,
      proposedFacts: facts.filter((fact) => fact.status === "proposed").length,
      approvedByKind: countBy(approved, (fact) => fact.kind)
        .map(({ key, count }) => ({ kind: key, count })),
    };
    sources.push(source({
      id: "agent-profile",
      label: "Agent DNA",
      detail: agentProfile.active
        ? `${agentProfile.approvedFacts} ${language === "nl" ? "goedgekeurde regels" : "approved rules"}`
        : language === "nl" ? "Profiel nog niet actief" : "Profile not active",
      status: agentProfile.active ? "ready" : "empty",
      updatedAt: profileResult.data?.updated_at ?? null,
    }));
  }

  const withoutSuggestions: Omit<LumenSnapshot, "suggestions"> = {
    generatedAt: new Date().toISOString(),
    periodDays: PERIOD_DAYS,
    support,
    painPoints,
    commerce,
    knowledge,
    agentProfile,
    sources,
  };
  return {
    ...withoutSuggestions,
    suggestions: buildLumenSuggestions(withoutSuggestions, language),
  };
}

export function lumenPromptSnapshot(snapshot: LumenSnapshot) {
  return JSON.stringify({
    generatedAt: snapshot.generatedAt,
    periodDays: snapshot.periodDays,
    support: snapshot.support,
    painPoints: snapshot.painPoints,
    commerce: snapshot.commerce,
    knowledge: snapshot.knowledge,
    agentProfile: snapshot.agentProfile,
  });
}
