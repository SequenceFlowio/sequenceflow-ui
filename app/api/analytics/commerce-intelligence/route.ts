import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  buildCommerceSignals,
  fallbackCommerceBriefing,
  parseCommerceBriefing,
  type CommerceBriefing,
} from "@/lib/analytics/commerceIntelligence";
import { analyticsWindow, parseAnalyticsDays } from "@/lib/analytics/core";
import { ANALYTICS_PLANS, getTenantPlanAccess } from "@/lib/billing";
import { getOpenAIClient } from "@/lib/openaiClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ANALYSIS_VERSION = 1;

function emptyCoverage() {
  return {
    orders: 0,
    soldUnits: 0,
    returnItems: 0,
    shipments: 0,
    linkedConversations: 0,
    completeOrderHistory: false as const,
  };
}

async function loadCommerceEvidence(tenantId: string, since: string) {
  const supabase = getSupabaseAdmin();
  const { data: orderRows, error: orderError } = await supabase
    .from("commerce_orders")
    .select("id,fulfillment_status,order_created_at")
    .eq("tenant_id", tenantId)
    .eq("provider", "bol")
    .gte("order_created_at", since)
    .order("order_created_at", { ascending: false })
    .limit(500);
  if (orderError) throw new Error(`Could not load commerce orders: ${orderError.message}`);

  const orders = orderRows ?? [];
  const orderIds = orders.map((order) => order.id);
  if (!orderIds.length) {
    return {
      orders: [],
      items: [],
      returnItems: [],
      shipments: [],
      links: [],
      offers: [],
    };
  }

  const [itemResult, shipmentResult, returnResult, linkResult, offerResult] = await Promise.all([
    supabase.from("commerce_order_items")
      .select("order_id,ean,sku,title,quantity,latest_delivery_at")
      .eq("tenant_id", tenantId)
      .in("order_id", orderIds),
    supabase.from("commerce_fulfillments")
      .select("order_id,tracking_number,status,latest_transport_event_at,shipment_date")
      .eq("tenant_id", tenantId)
      .in("order_id", orderIds),
    supabase.from("commerce_returns")
      .select("id,order_id")
      .eq("tenant_id", tenantId)
      .eq("provider", "bol")
      .gte("registered_at", since)
      .limit(500),
    supabase.from("conversation_entity_links")
      .select("order_id,conversation_id")
      .eq("tenant_id", tenantId)
      .eq("link_status", "linked")
      .in("order_id", orderIds)
      .gte("created_at", since),
    supabase.from("commerce_offer_snapshots")
      .select("external_id,ean,stock_amount,corrected_stock,last_synced_at")
      .eq("tenant_id", tenantId)
      .in("order_id", orderIds)
      .order("last_synced_at", { ascending: false }),
  ]);
  for (const result of [itemResult, shipmentResult, returnResult, linkResult, offerResult]) {
    if (result.error) throw new Error(`Could not load commerce evidence: ${result.error.message}`);
  }

  const returnIds = (returnResult.data ?? []).map((row) => row.id);
  const returnItemResult = returnIds.length
    ? await supabase.from("commerce_return_items")
        .select("return_id,order_id,ean,title,expected_quantity,reason")
        .eq("tenant_id", tenantId)
        .in("return_id", returnIds)
    : { data: [], error: null };
  if (returnItemResult.error) throw new Error(`Could not load return evidence: ${returnItemResult.error.message}`);

  const conversationIds = [...new Set((linkResult.data ?? []).map((row) => row.conversation_id))];
  const conversationResult = conversationIds.length
    ? await supabase.from("support_conversations")
        .select("id,latest_decision_id")
        .eq("tenant_id", tenantId)
        .in("id", conversationIds)
    : { data: [], error: null };
  if (conversationResult.error) throw new Error(`Could not load linked conversations: ${conversationResult.error.message}`);

  const decisionIds = (conversationResult.data ?? [])
    .map((row) => row.latest_decision_id)
    .filter((id): id is string => Boolean(id));
  const decisionResult = decisionIds.length
    ? await supabase.from("support_decisions")
        .select("id,intent")
        .eq("tenant_id", tenantId)
        .in("id", decisionIds)
    : { data: [], error: null };
  if (decisionResult.error) throw new Error(`Could not load conversation intents: ${decisionResult.error.message}`);

  const intentByDecision = new Map((decisionResult.data ?? []).map((row) => [row.id, row.intent]));
  const intentByConversation = new Map((conversationResult.data ?? []).map((row) => [
    row.id,
    row.latest_decision_id ? intentByDecision.get(row.latest_decision_id) ?? null : null,
  ]));

  return {
    orders: orders.map((order) => ({
      id: order.id,
      status: order.fulfillment_status,
    })),
    items: (itemResult.data ?? []).map((item) => ({
      orderId: item.order_id,
      ean: item.ean,
      sku: item.sku,
      title: item.title,
      quantity: Number(item.quantity || 0),
      latestDeliveryAt: item.latest_delivery_at,
    })),
    returnItems: (returnItemResult.data ?? []).map((item) => ({
      orderId: item.order_id,
      ean: item.ean,
      title: item.title,
      quantity: Number(item.expected_quantity || 0),
      reason: item.reason,
    })),
    shipments: (shipmentResult.data ?? []).map((shipment) => ({
      orderId: shipment.order_id,
      trackingNumber: shipment.tracking_number,
      status: shipment.status,
      latestEventAt: shipment.latest_transport_event_at,
      shippedAt: shipment.shipment_date,
    })),
    links: (linkResult.data ?? []).map((link) => ({
      orderId: link.order_id,
      conversationId: link.conversation_id,
      intent: intentByConversation.get(link.conversation_id) ?? null,
    })),
    offers: (offerResult.data ?? []).map((offer) => ({
      ean: offer.ean,
      offerId: offer.external_id,
      stock: offer.corrected_stock ?? offer.stock_amount,
    })),
  };
}

async function createBriefing(signals: ReturnType<typeof buildCommerceSignals>["signals"]) {
  const openai = getOpenAIClient();
  const evidence = signals.map((signal) => ({
    signal_id: signal.id,
    type: signal.type,
    severity: signal.severity,
    finding: signal.finding,
    recommended_action: signal.recommendedAction,
    evidence: signal.evidence,
  }));
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [{
      role: "user",
      content: `Je bent een operationeel e-commerce-analist. Maak een korte Nederlandse managementbriefing op basis van uitsluitend de bewezen signalen hieronder.

Regels:
- Selecteer maximaal drie prioriteiten.
- Verwijs exact naar een bestaande signal_id.
- Voeg geen feiten, oorzaken, percentages of omzetclaims toe.
- Benoem onzekerheid als de data geen volledige orderhistorie bevat.
- Formuleer concreet, rustig en actiegericht.

Antwoord uitsluitend met JSON:
{
  "summary": "Maximaal drie zinnen.",
  "priorities": [
    {
      "signal_id": "exact bestaand id",
      "headline": "Korte prioriteit",
      "explanation": "Wat het bewijs wel en niet zegt.",
      "recommended_action": "Concrete volgende stap."
    }
  ]
}

Bewijs:
${JSON.stringify(evidence)}`,
    }],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Commerce intelligence returned no content");
  return parseCommerceBriefing(JSON.parse(content), signals);
}

async function handleRequest(req: Request, forceRefresh: boolean) {
  try {
    const context = await getTenantId(req);
    if (forceRefresh && context.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { plan } = await getTenantPlanAccess(context.tenantId);
    if (!ANALYTICS_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Analytics requires Pro plan", upgrade: true }, { status: 403 });
    }

    const days = parseAnalyticsDays(new URL(req.url).searchParams.get("days"));
    const range = analyticsWindow(days);
    const supabase = getSupabaseAdmin();
    const { data: connection, error: connectionError } = await supabase
      .from("commerce_connections")
      .select("id")
      .eq("tenant_id", context.tenantId)
      .eq("provider", "bol")
      .eq("status", "active")
      .maybeSingle();
    if (connectionError) throw new Error(`Could not inspect bol.com connection: ${connectionError.message}`);
    if (!connection) {
      return NextResponse.json({
        commerceConnected: false,
        insufficient: true,
        coverage: emptyCoverage(),
        signals: [],
        canRefresh: context.role === "admin",
      });
    }

    const evidence = await loadCommerceEvidence(context.tenantId, range.since);
    const { coverage, signals } = buildCommerceSignals(evidence);
    const inputHash = createHash("sha256")
      .update(JSON.stringify({ days, coverage, signals }))
      .digest("hex");

    if (!signals.length) {
      return NextResponse.json({
        commerceConnected: true,
        insufficient: true,
        coverage,
        signals,
        canRefresh: context.role === "admin",
        generatedAt: range.generatedAt,
      });
    }

    if (!forceRefresh) {
      const ttl = days === 7 ? 6 : 24;
      const cutoff = new Date(Date.now() - ttl * 60 * 60 * 1000).toISOString();
      const { data: cached, error: cacheError } = await supabase
        .from("commerce_intelligence_briefings")
        .select("briefing,generated_at")
        .eq("tenant_id", context.tenantId)
        .eq("period_days", days)
        .eq("input_hash", inputHash)
        .eq("analysis_version", ANALYSIS_VERSION)
        .gte("generated_at", cutoff)
        .maybeSingle();
      if (cacheError) throw new Error(`Could not load commerce intelligence cache: ${cacheError.message}`);
      if (cached) {
        return NextResponse.json({
          commerceConnected: true,
          insufficient: false,
          coverage,
          signals,
          briefing: cached.briefing as CommerceBriefing,
          generatedAt: cached.generated_at,
          generatedBy: "ai",
          canRefresh: context.role === "admin",
        });
      }
    }

    let briefing: CommerceBriefing;
    let generatedBy: "ai" | "rules" = "ai";
    try {
      briefing = await createBriefing(signals);
    } catch (error) {
      console.error("[commerce-intelligence/generate]", error);
      briefing = fallbackCommerceBriefing(signals);
      generatedBy = "rules";
    }
    const generatedAt = new Date().toISOString();
    const { error: storeError } = await supabase.from("commerce_intelligence_briefings").upsert({
      tenant_id: context.tenantId,
      period_days: days,
      input_hash: inputHash,
      analysis_version: ANALYSIS_VERSION,
      source_counts: coverage,
      signals,
      briefing,
      generated_at: generatedAt,
      updated_at: generatedAt,
    }, { onConflict: "tenant_id,period_days" });
    if (storeError) throw new Error(`Could not store commerce intelligence: ${storeError.message}`);

    return NextResponse.json({
      commerceConnected: true,
      insufficient: false,
      coverage,
      signals,
      briefing,
      generatedAt,
      generatedBy,
      canRefresh: context.role === "admin",
    });
  } catch (error) {
    console.error("[analytics/commerce-intelligence]", error);
    return NextResponse.json({
      error: "Commerce Intelligence kon niet worden opgebouwd.",
      retryable: true,
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleRequest(req, false);
}

export async function POST(req: Request) {
  return handleRequest(req, true);
}
