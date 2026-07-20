import { NextResponse } from "next/server";

import { median } from "@/lib/commerce/metrics";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  return Boolean(process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const metricDate = startIso.slice(0, 10);
  const [connectionTenants, actionTenants, learningTenants, outcomeTenants] = await Promise.all([
    supabase.from("commerce_connections").select("tenant_id"),
    supabase.from("commerce_action_proposals").select("tenant_id").gte("created_at", startIso).lt("created_at", endIso),
    supabase.from("profile_learning_events").select("tenant_id").gte("created_at", startIso).lt("created_at", endIso),
    supabase.from("operational_outcomes").select("tenant_id").gte("occurred_at", startIso).lt("occurred_at", endIso),
  ]);
  const tenantLookupError = connectionTenants.error || actionTenants.error || learningTenants.error || outcomeTenants.error;
  if (tenantLookupError) return NextResponse.json({ error: tenantLookupError.message }, { status: 500 });
  const tenants = [...new Set([
    ...(connectionTenants.data ?? []),
    ...(actionTenants.data ?? []),
    ...(learningTenants.data ?? []),
    ...(outcomeTenants.data ?? []),
  ].map((row) => row.tenant_id))];
  let updated = 0;
  const failures: string[] = [];

  for (const tenantId of tenants) {
    const [actionResult, learningResult, outcomeResult] = await Promise.all([
      supabase.from("commerce_action_proposals").select("id").eq("tenant_id", tenantId).gte("created_at", startIso).lt("created_at", endIso),
      supabase.from("profile_learning_events").select("edit_distance").eq("tenant_id", tenantId).gte("created_at", startIso).lt("created_at", endIso),
      supabase.from("operational_outcomes").select("outcome_type").eq("tenant_id", tenantId).gte("occurred_at", startIso).lt("occurred_at", endIso),
    ]);
    const queryError = actionResult.error || learningResult.error || outcomeResult.error;
    if (queryError) {
      failures.push(`${tenantId}: ${queryError.message}`);
      continue;
    }
    const actions = actionResult.data;
    const learning = learningResult.data;
    const outcomes = outcomeResult.data;
    const actionRows = actions ?? [];
    const actionIds = actionRows.map((row) => row.id);
    const lifecycleResult = actionIds.length
      ? await supabase.from("operational_outcomes").select("action_id,outcome_type").eq("tenant_id", tenantId)
          .in("action_id", actionIds).in("outcome_type", ["action_approved", "action_succeeded"])
      : { data: [] as Array<{ action_id: string; outcome_type: string }>, error: null };
    if (lifecycleResult.error) {
      failures.push(`${tenantId}: ${lifecycleResult.error.message}`);
      continue;
    }
    const approvalCount = new Set((lifecycleResult.data ?? []).filter((row) => row.outcome_type === "action_approved").map((row) => row.action_id)).size;
    const successCount = new Set((lifecycleResult.data ?? []).filter((row) => row.outcome_type === "action_succeeded").map((row) => row.action_id)).size;
    const distances = (learning ?? []).map((row) => Number(row.edit_distance));
    const replyCount = (outcomes ?? []).filter((row) => row.outcome_type === "reply_sent").length;
    const repeat7Count = (outcomes ?? []).filter((row) => row.outcome_type === "repeat_contact_7d").length;
    const repeat30Count = (outcomes ?? []).filter((row) => row.outcome_type === "repeat_contact_30d").length;
    const contextOutcomes = (outcomes ?? []).filter((row) => ["commerce_context_matched", "commerce_context_ambiguous", "commerce_context_unmatched"].includes(row.outcome_type));
    const contextMatchCount = contextOutcomes.filter((row) => row.outcome_type === "commerce_context_matched").length;
    const metrics = {
      commerceResolutionAttempts: contextOutcomes.length,
      contextMatchRate: contextOutcomes.length ? contextMatchCount / contextOutcomes.length : 0,
      correctionRate: distances.length ? distances.filter((distance) => distance >= 0.03).length / distances.length : 0,
      medianEditDistance: median(distances),
      actionProposalCount: actionRows.length,
      actionApprovalRate: actionRows.length ? approvalCount / actionRows.length : 0,
      actionSuccessRate: approvalCount ? successCount / approvalCount : 0,
      repeatContact7dRate: replyCount ? repeat7Count / replyCount : 0,
      repeatContact30dRate: replyCount ? repeat30Count / replyCount : 0,
    };
    const { error: upsertError } = await supabase.from("operational_metrics_daily").upsert({
      tenant_id: tenantId, metric_date: metricDate, metrics, updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,metric_date" });
    if (upsertError) failures.push(`${tenantId}: ${upsertError.message}`);
    else updated += 1;
  }

  return NextResponse.json(
    { ok: failures.length === 0, metricDate, tenants: tenants.length, updated, failures },
    { status: failures.length ? 500 : 200 },
  );
}
