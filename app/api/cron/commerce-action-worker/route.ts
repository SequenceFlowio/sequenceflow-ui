import { NextResponse } from "next/server";

import { executeCancellation, finalizeCommerceActionExecution } from "@/lib/commerce/actions";
import { reloadCommerceConnection } from "@/lib/commerce/connections";
import { commerceAdapterFor, commercePermissionIssue } from "@/lib/commerce/adapter";
import { prepareCancellationConfirmation } from "@/lib/commerce/confirmation";
import { evaluateCancellationRetry } from "@/lib/commerce/eligibility";
import { loadOrderContext, upsertCommerceOrder } from "@/lib/commerce/repository";
import { WooCommerceRequestError } from "@/lib/commerce/woocommerceHttp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  return Boolean(process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const { data: approvedAction, error: approvedQueueError } = await supabase.from("commerce_action_proposals")
    .select("id,tenant_id")
    .eq("status", "approved")
    .order("approved_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (approvedQueueError) return NextResponse.json({ error: approvedQueueError.message }, { status: 500 });
  if (approvedAction) {
    try {
      const recovered = await executeCancellation({ tenantId: approvedAction.tenant_id, actionId: approvedAction.id });
      return NextResponse.json({ ok: true, recoveredApprovals: 1, recoveredStatus: recovered.status, checked: 0, completed: recovered.status === "succeeded" ? 1 : 0, failed: 0 });
    } catch (error) {
      console.error("[commerce-action-worker/approved]", approvedAction.id, error);
      return NextResponse.json({ ok: true, recoveredApprovals: 1, recoveredStatus: "failed", checked: 0, completed: 0, failed: 1 });
    }
  }
  const requestedLimit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(requestedLimit) ? Math.max(0, Math.min(100, Math.floor(requestedLimit))) : 20;
  const { data: actions, error: queueError } = await supabase.from("commerce_action_proposals").select("id,tenant_id,conversation_id,order_id,action_fingerprint,updated_at")
    .eq("status", "executing").order("updated_at", { ascending: true }).limit(limit);
  if (queueError) return NextResponse.json({ error: queueError.message }, { status: 500 });
  let completed = 0;
  let failed = 0;
  for (const action of actions ?? []) {
    try {
      const storedOrder = await loadOrderContext(action.tenant_id, action.order_id);
      if (!storedOrder) throw new Error("Connection or order unavailable.");
      const connection = await reloadCommerceConnection(storedOrder.connectionId);
      if (connection.tenantId !== action.tenant_id) throw new Error("Commerce connection tenant mismatch.");
      const live = await commerceAdapterFor(connection).getOrder(connection, storedOrder.externalId);
      if (!live) throw new Error("Order no longer exists.");
      if (live.cancelledAt) {
        await upsertCommerceOrder(connection, live).catch((error) => {
          console.error("[commerce-action-worker/order-cache]", action.id, error);
        });
        const executionId = await executionForReconciliation(action.tenant_id, action.id);
        await finalizeCommerceActionExecution({
          tenantId: action.tenant_id,
          actionId: action.id,
          executionId,
          status: "succeeded",
          response: { verifiedProviderStatus: "cancelled", cancelledAt: live.cancelledAt },
        });
        completed += 1;
      } else if (connection.provider === "woocommerce") {
        const executionId = await executionForReconciliation(action.tenant_id, action.id);
        const configurationIssue = connection.status !== "active"
          ? "WooCommerce is not active."
          : connection.actionMode !== "approval_required"
            ? "WooCommerce cancellation approval is disabled."
            : commercePermissionIssue(connection);
        const eligibility = configurationIssue
          ? { allowed: false as const, reason: configurationIssue }
          : evaluateCancellationRetry({
              ...live,
              maxCancelAmount: connection.maxCancelAmount,
              shopCurrency: connection.shopCurrency,
              allowFullyRefundedClosure: true,
            });
        if (!eligibility.allowed) {
          await finalizeCommerceActionExecution({
            tenantId: action.tenant_id,
            actionId: action.id,
            executionId,
            status: "failed",
            error: eligibility.reason,
            response: { phase: "woocommerce_reconciliation_preflight" },
          });
          failed += 1;
          continue;
        }
        try {
          const result = await commerceAdapterFor(connection).cancelOrder(connection, {
            externalOrderId: storedOrder.externalId,
            staffNote: `SequenceFlow conversation ${action.conversation_id}`,
            idempotencyKey: action.action_fingerprint,
          });
          await finalizeCommerceActionExecution({
            tenantId: action.tenant_id,
            actionId: action.id,
            executionId,
            status: result.status === "succeeded" ? "succeeded" : "provider_pending",
            response: result.response,
            providerJobId: result.providerJobId,
          });
          if (result.status === "succeeded") completed += 1;
        } catch (error) {
          if (error instanceof WooCommerceRequestError && error.unknownMutationOutcome) throw error;
          const message = error instanceof Error ? error.message : "WooCommerce cancellation reconciliation failed.";
          await finalizeCommerceActionExecution({
            tenantId: action.tenant_id,
            actionId: action.id,
            executionId,
            status: "failed",
            error: message,
            response: { phase: "woocommerce_reconciliation" },
          });
          failed += 1;
        }
      } else if (Date.now() - new Date(action.updated_at).getTime() > 15 * 60 * 1000) {
        const message = "The commerce provider did not confirm cancellation within 15 minutes.";
        const executionId = await executionForReconciliation(action.tenant_id, action.id);
        await finalizeCommerceActionExecution({
          tenantId: action.tenant_id,
          actionId: action.id,
          executionId,
          status: "failed",
          response: { verifiedProviderStatus: "not_cancelled" },
          error: message,
        });
        failed += 1;
      } else {
        await upsertCommerceOrder(connection, live);
      }
    } catch (error) {
      console.error("[commerce-action-worker]", action.id, error);
      if (Date.now() - new Date(action.updated_at).getTime() > 15 * 60 * 1000) {
        const message = error instanceof Error ? error.message : "Commerce job polling failed.";
        try {
          const executionId = await executionForReconciliation(action.tenant_id, action.id);
          await finalizeCommerceActionExecution({
            tenantId: action.tenant_id,
            actionId: action.id,
            executionId,
            status: "failed",
            error: message,
            response: { phase: "job_poll" },
          });
          failed += 1;
        } catch (finalizeError) {
          console.error("[commerce-action-worker/finalize]", action.id, finalizeError);
        }
      }
    }
  }
  const confirmation = await processCancellationConfirmation();
  return NextResponse.json({
    ok: true,
    recoveredApprovals: 0,
    checked: actions?.length ?? 0,
    completed,
    failed,
    confirmation,
  });
}

async function processCancellationConfirmation() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("claim_cancellation_confirmations", { p_limit: 1 });
  if (error) throw new Error(`Could not claim a cancellation confirmation: ${error.message}`);
  const claimed = Array.isArray(data) ? data[0] : null;
  if (!claimed) return { claimed: 0, prepared: 0, failed: 0 };

  try {
    await prepareCancellationConfirmation({
      tenantId: String(claimed.tenant_id),
      actionId: String(claimed.action_id),
      conversationId: String(claimed.conversation_id),
    });
    return { claimed: 1, prepared: 1, failed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cancellation confirmation generation failed.";
    const attempts = Number(claimed.attempts ?? 1);
    const delayMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
    const retryAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
    const { error: updateError } = await supabase
      .from("commerce_action_proposals")
      .update({
        confirmation_status: "failed",
        confirmation_error: message.slice(0, 1_000),
        confirmation_processing_started_at: null,
        confirmation_next_attempt_at: retryAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.action_id)
      .eq("tenant_id", claimed.tenant_id)
      .eq("status", "succeeded")
      .eq("confirmation_status", "preparing");
    if (updateError) console.error("[commerce-action-worker/confirmation-state]", claimed.action_id, updateError);
    console.error("[commerce-action-worker/confirmation]", claimed.action_id, error);
    return { claimed: 1, prepared: 0, failed: 1 };
  }
}

async function executionForReconciliation(tenantId: string, actionId: string) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase.from("commerce_action_executions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("proposal_id", actionId)
    .in("status", ["started", "provider_pending"])
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(`Could not load the pending action execution: ${existingError.message}`);
  if (existing?.id) return String(existing.id);

  const { count, error: countError } = await supabase.from("commerce_action_executions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("proposal_id", actionId);
  if (countError) throw new Error(`Could not count action attempts: ${countError.message}`);
  const { data: created, error: createError } = await supabase.from("commerce_action_executions").insert({
    tenant_id: tenantId,
    proposal_id: actionId,
    attempt: (count ?? 0) + 1,
    status: "started",
    request_data: { reconciliationOnly: true },
  }).select("id").single();
  if (createError || !created) throw new Error(`Could not create reconciliation evidence: ${createError?.message ?? "missing id"}`);
  return String(created.id);
}
