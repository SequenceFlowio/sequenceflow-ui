import { NextResponse } from "next/server";

import { ANALYTICS_PLANS, getTenantPlan } from "@/lib/billing";
import { median } from "@/lib/commerce/metrics";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan } = await getTenantPlan(tenantId);
    if (!ANALYTICS_PLANS.includes(plan)) return NextResponse.json({ error: "Analytics requires Pro plan", upgrade: true }, { status: 403 });
    const supabase = getSupabaseAdmin();
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since35 = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [contextResult, actionResult, learningResult, repeatResult, skuActionResult] = await Promise.all([
      supabase.from("operational_outcomes").select("outcome_type").eq("tenant_id", tenantId)
        .in("outcome_type", ["commerce_context_matched", "commerce_context_ambiguous", "commerce_context_unmatched"]).gte("occurred_at", since30),
      supabase.from("commerce_action_proposals").select("id,status,order_id,created_at").eq("tenant_id", tenantId).gte("created_at", since30),
      supabase.from("profile_learning_events").select("edit_distance").eq("tenant_id", tenantId).gte("created_at", since30),
      supabase.from("operational_outcomes").select("outcome_type").eq("tenant_id", tenantId).in("outcome_type", ["reply_sent", "repeat_contact_7d", "repeat_contact_30d"]).gte("occurred_at", since30),
      supabase.from("commerce_action_proposals").select("id,order_id,created_at").eq("tenant_id", tenantId).gte("created_at", since35),
    ]);
    for (const result of [contextResult, actionResult, learningResult, repeatResult, skuActionResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    const contextOutcomes = contextResult.data;
    const actions = actionResult.data;
    const learning = learningResult.data;
    const repeats = repeatResult.data;
    const skuActions = skuActionResult.data;
    const actionRows = actions ?? [];
    const actionIds = actionRows.map((action) => action.id);
    const lifecycleResult = actionIds.length
      ? await supabase.from("operational_outcomes").select("action_id,outcome_type").eq("tenant_id", tenantId)
          .in("action_id", actionIds).in("outcome_type", ["action_approved", "action_succeeded"])
      : { data: [] as Array<{ action_id: string; outcome_type: string }>, error: null };
    if (lifecycleResult.error) throw new Error(lifecycleResult.error.message);
    const approved = new Set((lifecycleResult.data ?? []).filter((row) => row.outcome_type === "action_approved").map((row) => row.action_id)).size;
    const succeeded = new Set((lifecycleResult.data ?? []).filter((row) => row.outcome_type === "action_succeeded").map((row) => row.action_id)).size;
    const distances = (learning ?? []).map((row) => Number(row.edit_distance));
    const correctionRate = distances.length ? distances.filter((distance) => distance >= 0.03).length / distances.length : 0;
    const medianEditDistance = median(distances);
    const replies = (repeats ?? []).filter((row) => row.outcome_type === "reply_sent").length;
    const repeat7 = (repeats ?? []).filter((row) => row.outcome_type === "repeat_contact_7d").length;
    const repeat30 = (repeats ?? []).filter((row) => row.outcome_type === "repeat_contact_30d").length;
    const contextAttempts = contextOutcomes?.length ?? 0;
    const contextMatches = (contextOutcomes ?? []).filter((row) => row.outcome_type === "commerce_context_matched").length;

    const skuActionRows = skuActions ?? [];
    const orderIds = [...new Set(skuActionRows.map((action) => action.order_id).filter(Boolean))];
    const itemResult = orderIds.length
      ? await supabase.from("commerce_order_items").select("order_id,sku,title").eq("tenant_id", tenantId).in("order_id", orderIds)
      : { data: [] as Array<{ order_id: string; sku: string | null; title: string }>, error: null };
    if (itemResult.error) throw new Error(itemResult.error.message);
    const items = itemResult.data;
    const actionsByOrder = new Map<string, string[]>();
    for (const action of skuActionRows) actionsByOrder.set(action.order_id, [...(actionsByOrder.get(action.order_id) ?? []), action.created_at]);
    const skuCounts = new Map<string, { label: string; current: number; baseline: number }>();
    const countedOrderSkus = new Set<string>();
    for (const item of items ?? []) {
      const key = item.sku || item.title;
      const orderSkuKey = `${item.order_id}:${key}`;
      if (countedOrderSkus.has(orderSkuKey)) continue;
      countedOrderSkus.add(orderSkuKey);
      const bucket = skuCounts.get(key) ?? { label: key, current: 0, baseline: 0 };
      for (const createdAt of actionsByOrder.get(item.order_id) ?? []) {
        if (createdAt >= since7) bucket.current += 1; else bucket.baseline += 1;
      }
      skuCounts.set(key, bucket);
    }
    const signals = [...skuCounts.values()]
      .map((row) => ({ ...row, baseline: row.baseline / 4 }))
      .filter((row) => row.current >= 5 && row.current >= 2 * Math.max(1, row.baseline))
      .sort((a, b) => b.current - a.current);
    return NextResponse.json({
      contextMatchRate: contextAttempts ? contextMatches / contextAttempts : 0,
      correctionRate, medianEditDistance,
      actionApprovalRate: actionRows.length ? approved / actionRows.length : 0,
      actionSuccessRate: approved ? succeeded / approved : 0,
      repeatContact7dRate: replies ? repeat7 / replies : 0,
      repeatContact30dRate: replies ? repeat30 / replies : 0,
      signals,
    });
  } catch (error) {
    console.error("[analytics/operations]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
