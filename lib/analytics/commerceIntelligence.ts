import { normalizeLearningText } from "../agentProfile/learning.ts";

export type CommerceIntelligenceOrder = {
  id: string;
  status: string | null;
};

export type CommerceIntelligenceItem = {
  orderId: string;
  ean: string | null;
  sku: string | null;
  title: string;
  quantity: number;
  latestDeliveryAt: string | null;
};

export type CommerceIntelligenceReturnItem = {
  orderId: string | null;
  ean: string | null;
  title: string | null;
  quantity: number;
  reason: string | null;
};

export type CommerceIntelligenceShipment = {
  orderId: string;
  trackingNumber: string | null;
  status: string | null;
  latestEventAt: string | null;
  shippedAt: string | null;
};

export type CommerceIntelligenceLink = {
  orderId: string;
  conversationId: string;
  intent: string | null;
};

export type CommerceIntelligenceOffer = {
  ean: string | null;
  offerId: string;
  stock: number | null;
};

export type CommerceSignal = {
  id: string;
  type: "returns" | "cross_source" | "shipping" | "delivery" | "stock";
  severity: "attention" | "high";
  title: string;
  finding: string;
  recommendedAction: string;
  sample: number;
  evidence: Array<{ label: string; value: number | string }>;
};

export type CommerceCoverage = {
  orders: number;
  soldUnits: number;
  returnItems: number;
  shipments: number;
  linkedConversations: number;
  completeOrderHistory: false;
};

export type CommerceBriefing = {
  summary: string;
  priorities: Array<{
    signalId: string;
    headline: string;
    explanation: string;
    recommendedAction: string;
  }>;
};

function productKey(item: { ean: string | null; title: string | null }, fallback: string) {
  return item.ean?.trim() || item.title?.trim().toLocaleLowerCase("nl-NL") || fallback;
}

function cleanBriefingText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return normalizeLearningText(value)
    .replace(/[“”„‟«»]/g, "")
    .replace(/^['"]+|['"]+$/g, "")
    .slice(0, maxLength)
    .trim();
}

export function buildCommerceSignals(input: {
  orders: CommerceIntelligenceOrder[];
  items: CommerceIntelligenceItem[];
  returnItems: CommerceIntelligenceReturnItem[];
  shipments: CommerceIntelligenceShipment[];
  links: CommerceIntelligenceLink[];
  offers: CommerceIntelligenceOffer[];
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const orderById = new Map(input.orders.map((order) => [order.id, order]));
  const itemsByOrder = new Map<string, CommerceIntelligenceItem[]>();
  for (const item of input.items) {
    itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
  }

  const productRows = new Map<string, {
    label: string;
    ean: string | null;
    orderedUnits: number;
    returnUnits: number;
    reasons: Map<string, number>;
    conversations: Set<string>;
    intents: Map<string, number>;
    stock: number | null;
  }>();

  for (const item of input.items) {
    const key = productKey(item, `${item.orderId}:${item.title}`);
    const row = productRows.get(key) ?? {
      label: item.title || item.ean || "Onbekend artikel",
      ean: item.ean,
      orderedUnits: 0,
      returnUnits: 0,
      reasons: new Map<string, number>(),
      conversations: new Set<string>(),
      intents: new Map<string, number>(),
      stock: null,
    };
    row.orderedUnits += Math.max(0, Number(item.quantity || 0));
    productRows.set(key, row);
  }

  for (const returnItem of input.returnItems) {
    const orderItems = returnItem.orderId ? itemsByOrder.get(returnItem.orderId) ?? [] : [];
    const matchingOrderItem = returnItem.ean
      ? orderItems.find((item) => item.ean === returnItem.ean)
      : orderItems.length === 1 ? orderItems[0] : null;
    const key = productKey(returnItem, matchingOrderItem
      ? productKey(matchingOrderItem, matchingOrderItem.orderId)
      : `return:${returnItem.orderId ?? "unknown"}`);
    const row = productRows.get(key) ?? {
      label: returnItem.title || matchingOrderItem?.title || returnItem.ean || "Onbekend artikel",
      ean: returnItem.ean || matchingOrderItem?.ean || null,
      orderedUnits: 0,
      returnUnits: 0,
      reasons: new Map<string, number>(),
      conversations: new Set<string>(),
      intents: new Map<string, number>(),
      stock: null,
    };
    const quantity = Math.max(0, Number(returnItem.quantity || 0));
    row.returnUnits += quantity;
    if (returnItem.reason) row.reasons.set(returnItem.reason, (row.reasons.get(returnItem.reason) ?? 0) + quantity);
    productRows.set(key, row);
  }

  for (const link of input.links) {
    const orderItems = itemsByOrder.get(link.orderId) ?? [];
    const uniqueProducts = [...new Set(orderItems.map((item) => productKey(item, `${item.orderId}:${item.title}`)))];
    if (uniqueProducts.length !== 1) continue;
    const row = productRows.get(uniqueProducts[0]);
    if (!row) continue;
    row.conversations.add(link.conversationId);
    if (link.intent) row.intents.set(link.intent, (row.intents.get(link.intent) ?? 0) + 1);
  }

  const latestOfferByProduct = new Map<string, CommerceIntelligenceOffer>();
  for (const offer of input.offers) {
    const key = offer.ean || offer.offerId;
    if (!latestOfferByProduct.has(key)) latestOfferByProduct.set(key, offer);
  }
  for (const [key, row] of productRows) {
    const offer = row.ean ? latestOfferByProduct.get(row.ean) : null;
    if (offer?.stock !== null && offer?.stock !== undefined) row.stock = Number(offer.stock);
    else if (!row.ean) row.stock = latestOfferByProduct.get(key)?.stock ?? null;
  }

  const signals: CommerceSignal[] = [];
  for (const [key, row] of productRows) {
    const safeId = Buffer.from(key).toString("base64url").slice(0, 32);
    const topReason = [...row.reasons.entries()].sort((left, right) => right[1] - left[1])[0];
    if (row.returnUnits >= 5) {
      signals.push({
        id: `returns:${safeId}`,
        type: "returns",
        severity: row.returnUnits >= 10 ? "high" : "attention",
        title: `${row.label} heeft meerdere retouren`,
        finding: `${row.returnUnits} retourartikelen zijn geregistreerd in de gesynchroniseerde periode${topReason ? `; de meest voorkomende reden is ${topReason[0]}` : ""}.`,
        recommendedAction: "Controleer productverwachting, productinformatie en de belangrijkste retourreden.",
        sample: row.returnUnits,
        evidence: [
          { label: "Retourartikelen", value: row.returnUnits },
          ...(topReason ? [{ label: "Belangrijkste reden", value: topReason[0] }] : []),
        ],
      });
    }
    if (row.returnUnits >= 3 && row.conversations.size >= 3 && row.returnUnits + row.conversations.size >= 8) {
      const topIntent = [...row.intents.entries()].sort((left, right) => right[1] - left[1])[0];
      signals.push({
        id: `cross:${safeId}`,
        type: "cross_source",
        severity: row.returnUnits >= 5 && row.conversations.size >= 5 ? "high" : "attention",
        title: `${row.label} komt terug in retouren en klantcontact`,
        finding: `${row.returnUnits} retourartikelen vallen samen met ${row.conversations.size} gekoppelde klantgesprekken${topIntent ? `; het meest voorkomende gesprekstype is ${topIntent[0]}` : ""}.`,
        recommendedAction: "Onderzoek dit product gezamenlijk met support, logistiek en content.",
        sample: row.returnUnits + row.conversations.size,
        evidence: [
          { label: "Retourartikelen", value: row.returnUnits },
          { label: "Gekoppelde gesprekken", value: row.conversations.size },
          ...(topIntent ? [{ label: "Meest voorkomend gesprekstype", value: topIntent[0] }] : []),
        ],
      });
    }
    if (row.stock !== null && row.stock <= 5 && row.orderedUnits >= 5) {
      signals.push({
        id: `stock:${safeId}`,
        type: "stock",
        severity: row.stock <= 1 ? "high" : "attention",
        title: `${row.label} heeft weinig voorraad`,
        finding: `De bekende voorraad is ${row.stock}, terwijl ${row.orderedUnits} verkochte stuks in de gesynchroniseerde periode zichtbaar zijn.`,
        recommendedAction: "Controleer de aanvulling en voorkom dat de leverbelofte achterloopt op de voorraad.",
        sample: row.orderedUnits,
        evidence: [
          { label: "Bekende voorraad", value: row.stock },
          { label: "Verkochte stuks zichtbaar", value: row.orderedUnits },
        ],
      });
    }
  }

  const shipmentsWithoutScan = input.shipments.filter((shipment) =>
    Boolean(shipment.trackingNumber) && !shipment.status && !shipment.latestEventAt).length;
  if (shipmentsWithoutScan >= 3) {
    signals.push({
      id: "shipping:no-scan",
      type: "shipping",
      severity: shipmentsWithoutScan >= 10 ? "high" : "attention",
      title: "Meerdere verzendingen missen een transportscan",
      finding: `${shipmentsWithoutScan} verzendingen hebben track & trace, maar nog geen transportevent van bol.com.`,
      recommendedAction: "Controleer deze zendingen en informeer klanten proactief wanneer de scan uitblijft.",
      sample: shipmentsWithoutScan,
      evidence: [{ label: "Zendingen zonder scan", value: shipmentsWithoutScan }],
    });
  }

  const lateOrderIds = new Set(input.items.filter((item) => {
    const order = orderById.get(item.orderId);
    const dueAt = Date.parse(item.latestDeliveryAt ?? "");
    return ["OPEN", "PARTIALLY_SHIPPED"].includes(order?.status ?? "")
      && Number.isFinite(dueAt)
      && dueAt < now;
  }).map((item) => item.orderId));
  if (lateOrderIds.size >= 3) {
    signals.push({
      id: "delivery:promise-passed",
      type: "delivery",
      severity: lateOrderIds.size >= 10 ? "high" : "attention",
      title: "Bezorgbeloftes zijn verstreken",
      finding: `${lateOrderIds.size} open orders hebben een bezorgbelofte die inmiddels is verstreken.`,
      recommendedAction: "Controleer de actuele vervoerdersstatus en stuur waar nodig proactief een update.",
      sample: lateOrderIds.size,
      evidence: [{ label: "Open orders na bezorgbelofte", value: lateOrderIds.size }],
    });
  }

  const coverage: CommerceCoverage = {
    orders: input.orders.length,
    soldUnits: input.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0),
    returnItems: input.returnItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0),
    shipments: input.shipments.length,
    linkedConversations: new Set(input.links.map((link) => link.conversationId)).size,
    completeOrderHistory: false,
  };

  return {
    coverage,
    signals: signals
      .sort((left, right) => {
        if (left.severity !== right.severity) return left.severity === "high" ? -1 : 1;
        return right.sample - left.sample;
      })
      .slice(0, 8),
  };
}

export function parseCommerceBriefing(value: unknown, signals: CommerceSignal[]): CommerceBriefing {
  const parsed = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const signalById = new Map(signals.map((signal) => [signal.id, signal]));
  const priorities: CommerceBriefing["priorities"] = [];
  const used = new Set<string>();
  const rows = Array.isArray(parsed.priorities) ? parsed.priorities.slice(0, 3) : [];
  for (const raw of rows) {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const signalId = typeof row.signal_id === "string" ? row.signal_id : "";
    if (!signalById.has(signalId) || used.has(signalId)) continue;
    const headline = cleanBriefingText(row.headline, 120);
    const explanation = cleanBriefingText(row.explanation, 360);
    const recommendedAction = cleanBriefingText(row.recommended_action, 280);
    if (!headline || !explanation || !recommendedAction) continue;
    used.add(signalId);
    priorities.push({ signalId, headline, explanation, recommendedAction });
  }
  const summary = cleanBriefingText(parsed.summary, 600);
  if (!summary || !priorities.length) throw new Error("Commerce briefing did not preserve its evidence");
  return { summary, priorities };
}

export function fallbackCommerceBriefing(signals: CommerceSignal[]): CommerceBriefing {
  const selected = signals.slice(0, 3);
  return {
    summary: selected.length
      ? `${selected.length} operationele signalen vragen aandacht. Begin bij ${selected[0].title.toLocaleLowerCase("nl-NL")}.`
      : "Er is nog onvoldoende bewijs voor een operationele prioriteit.",
    priorities: selected.map((signal) => ({
      signalId: signal.id,
      headline: signal.title,
      explanation: signal.finding,
      recommendedAction: signal.recommendedAction,
    })),
  };
}
