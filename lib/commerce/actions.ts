import { reloadCommerceConnection } from "@/lib/commerce/connections";
import { commerceAdapterFor, commercePermissionIssue } from "@/lib/commerce/adapter";
import { evaluateCancellation, type CancellationEligibility } from "@/lib/commerce/eligibility";
import { cancellationActionFingerprint, hasExplicitCancellationIntent } from "@/lib/commerce/identity";
import { loadOrderContext, upsertCommerceOrder } from "@/lib/commerce/repository";
import { isUnknownShopifyMutationOutcome } from "@/lib/commerce/shopifyHttp";
import { WooCommerceRequestError } from "@/lib/commerce/woocommerceHttp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function createCancellationProposal(input: {
  tenantId: string;
  conversationId: string;
  decisionId: string;
  sourceMessageId: string | null;
  orderId: string;
  customerText: string;
  rationale: string;
}) {
  if (!hasExplicitCancellationIntent(input.customerText)) return null;
  const order = await loadOrderContext(input.tenantId, input.orderId);
  if (!order) return null;
  const connection = await reloadCommerceConnection(order.connectionId);
  if (connection.tenantId !== input.tenantId || connection.status !== "active" || connection.actionMode !== "approval_required") return null;
  const scopeIssue = commercePermissionIssue(connection);
  const eligibility: CancellationEligibility = scopeIssue
    ? { allowed: false, reason: scopeIssue }
    : evaluateCancellation({ ...order, maxCancelAmount: connection.maxCancelAmount, shopCurrency: connection.shopCurrency });
  const fingerprint = cancellationActionFingerprint({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    sourceMessageId: input.sourceMessageId ?? input.decisionId,
    externalOrderId: order.externalId,
  });
  const status = eligibility.allowed ? "proposed" : "blocked";
  const supabase = getSupabaseAdmin();
  const { data: inserted, error } = await supabase.from("commerce_action_proposals").upsert({
    tenant_id: input.tenantId, conversation_id: input.conversationId, decision_id: input.decisionId,
    order_id: order.id, action_type: "cancel_order", action_fingerprint: fingerprint,
    rationale: eligibility.allowed ? input.rationale : eligibility.reason, risk_level: eligibility.allowed ? "high" : "blocked",
    policy_snapshot: { mode: connection.actionMode, maxCancelAmount: connection.maxCancelAmount, shopCurrency: connection.shopCurrency, version: 1 },
    order_snapshot: { orderId: order.id, displayName: order.displayName, totalAmount: order.totalAmount, currencyCode: order.currencyCode, externalId: order.externalId },
    parameters: { refundOriginalPayment: true, restock: true, notifyCustomer: false, reason: "CUSTOMER" },
    status, last_error: eligibility.allowed ? null : eligibility.reason, updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,action_fingerprint", ignoreDuplicates: true }).select("id,status").maybeSingle();
  if (error) throw new Error(`Could not save commerce action: ${error.message}`);
  const proposal = inserted ?? (await supabase.from("commerce_action_proposals").select("id,status")
    .eq("tenant_id", input.tenantId).eq("action_fingerprint", fingerprint).single()).data;
  if (!proposal) throw new Error("Could not load the idempotent commerce action.");
  if (["proposed", "approved", "executing", "succeeded", "failed", "blocked"].includes(proposal.status)) {
    const { error: blockingError } = await supabase.from("support_decisions")
      .update({ blocking_action_id: proposal.id, requires_human: true })
      .eq("id", input.decisionId).eq("tenant_id", input.tenantId);
    if (blockingError) throw new Error(`Could not block the decision on its commerce action: ${blockingError.message}`);
  }
  return proposal;
}

async function failPreflight(input: { tenantId: string; actionId: string; status: "failed" | "blocked"; message: string }) {
  const { error } = await getSupabaseAdmin().from("commerce_action_proposals").update({
    status: input.status, last_error: input.message, updated_at: new Date().toISOString(),
  }).eq("id", input.actionId).eq("tenant_id", input.tenantId).in("status", ["approved", "failed"]);
  if (error) throw new Error(`Could not persist the action preflight result: ${error.message}`);
}

export async function finalizeCommerceActionExecution(input: {
  tenantId: string;
  actionId: string;
  executionId: string;
  status: "provider_pending" | "succeeded" | "failed";
  response?: Record<string, unknown>;
  providerJobId?: string | null;
  error?: string | null;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("finalize_commerce_action_execution", {
    p_tenant_id: input.tenantId,
    p_proposal_id: input.actionId,
    p_execution_id: input.executionId,
    p_execution_status: input.status,
    p_response_data: input.response ?? {},
    p_provider_job_id: input.providerJobId ?? null,
    p_error: input.error ?? null,
  });
  if (error) throw new Error(`Could not finalize the commerce action atomically: ${error.message}`);
  return String(data);
}

export async function executeCancellation(input: { tenantId: string; actionId: string }) {
  const supabase = getSupabaseAdmin();
  const { data: action, error: actionError } = await supabase.from("commerce_action_proposals").select("*").eq("id", input.actionId).eq("tenant_id", input.tenantId).single();
  if (actionError || !action) throw new Error(actionError?.message ?? "Commerce action not found.");
  if (!['approved', 'failed'].includes(action.status)) return action;
  const storedOrder = await loadOrderContext(input.tenantId, action.order_id);
  if (!storedOrder) {
    const message = "Linked order not found.";
    await failPreflight({ ...input, status: "blocked", message });
    throw new Error(message);
  }
  let connection;
  try {
    connection = await reloadCommerceConnection(storedOrder.connectionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the commerce connection.";
    await failPreflight({ ...input, status: "failed", message });
    throw error;
  }
  if (connection.tenantId !== input.tenantId || connection.status !== "active" || connection.actionMode !== "approval_required") {
    const message = "Commerce actions are disabled or the connection is not active.";
    await failPreflight({ ...input, status: "blocked", message });
    throw new Error(message);
  }
  const scopeIssue = commercePermissionIssue(connection);
  if (scopeIssue) {
    const message = scopeIssue;
    await failPreflight({ ...input, status: "blocked", message });
    throw new Error(message);
  }
  const adapter = commerceAdapterFor(connection);
  let live;
  try {
    live = await adapter.getOrder(connection, storedOrder.externalId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commerce preflight failed.";
    await failPreflight({ ...input, status: "failed", message });
    throw error;
  }
  if (!live) {
    const message = "Order no longer exists at the commerce provider.";
    await failPreflight({ ...input, status: "blocked", message });
    throw new Error(message);
  }
  try {
    await upsertCommerceOrder(connection, live);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not persist the live commerce preflight.";
    await failPreflight({ ...input, status: "failed", message });
    throw error;
  }
  const { count: priorAttempts, error: priorAttemptsError } = await supabase.from("commerce_action_executions")
    .select("id", { count: "exact", head: true }).eq("proposal_id", action.id);
  if (priorAttemptsError) {
    await failPreflight({ ...input, status: "failed", message: priorAttemptsError.message });
    throw new Error(`Could not count prior cancellation attempts: ${priorAttemptsError.message}`);
  }
  if (live.cancelledAt && action.status === "failed") {
    if ((priorAttempts ?? 0) > 0) {
      const { data: reconciliation, error: reconciliationError } = await supabase.from("commerce_action_executions").insert({
        tenant_id: input.tenantId,
        proposal_id: action.id,
        attempt: (priorAttempts ?? 0) + 1,
        status: "started",
        request_data: { reconciliationOnly: true },
      }).select("id").single();
      if (reconciliationError?.code === "23505") return action;
      if (reconciliationError || !reconciliation) throw new Error(reconciliationError?.message ?? "Could not audit the commerce reconciliation.");
      await finalizeCommerceActionExecution({
        tenantId: input.tenantId,
        actionId: action.id,
        executionId: reconciliation.id,
        status: "succeeded",
        response: { verifiedProviderStatus: "cancelled", cancelledAt: live.cancelledAt },
      });
      return { ...action, status: "succeeded" };
    }
  }
  const retryingUnknownRefund = action.status === "failed"
    && (priorAttempts ?? 0) > 0
    && String(live.financialStatus ?? "").toUpperCase() === "REFUNDED";
  const eligibility = evaluateCancellation({
    ...live,
    financialStatus: retryingUnknownRefund ? null : live.financialStatus,
    maxCancelAmount: connection.maxCancelAmount,
    shopCurrency: connection.shopCurrency,
  });
  if (!eligibility.allowed) {
    await failPreflight({ ...input, status: "blocked", message: eligibility.reason });
    throw new Error(eligibility.reason);
  }

  const { data: claimed, error: claimError } = await supabase.from("commerce_action_proposals")
    .update({ status: "executing", last_error: null, updated_at: new Date().toISOString() })
    .eq("id", action.id).eq("tenant_id", input.tenantId).in("status", ["approved", "failed"]).select("id").maybeSingle();
  if (claimError) {
    await failPreflight({ ...input, status: "failed", message: claimError.message });
    throw new Error(claimError.message);
  }
  if (!claimed) return action;
  const { count, error: attemptCountError } = await supabase.from("commerce_action_executions").select("id", { count: "exact", head: true }).eq("proposal_id", action.id);
  if (attemptCountError) {
    const message = `Could not count cancellation attempts: ${attemptCountError.message}`;
    await supabase.from("commerce_action_proposals").update({
      status: "failed", last_error: message, updated_at: new Date().toISOString(),
    }).eq("id", action.id).eq("tenant_id", input.tenantId).eq("status", "executing");
    throw new Error(message);
  }
  const attempt = (count ?? 0) + 1;
  const { data: execution, error: executionError } = await supabase.from("commerce_action_executions").insert({
    tenant_id: input.tenantId, proposal_id: action.id, attempt, status: "started",
    request_data: { orderId: live.externalId, reason: "CUSTOMER", refundOriginalPayment: true, restock: true, notifyCustomer: false },
  }).select("id").single();
  if (executionError || !execution) {
    const message = executionError?.message ?? "Could not create the cancellation audit record.";
    await supabase.from("commerce_action_proposals").update({
      status: "failed", last_error: message, updated_at: new Date().toISOString(),
    }).eq("id", action.id).eq("tenant_id", input.tenantId).eq("status", "executing");
    throw new Error(message);
  }
  try {
    const result = await adapter.cancelOrder(connection, { externalOrderId: live.externalId, staffNote: `SequenceFlow conversation ${action.conversation_id}`, idempotencyKey: action.action_fingerprint });
    const succeeded = result.status === "succeeded";
    await finalizeCommerceActionExecution({
      tenantId: input.tenantId,
      actionId: action.id,
      executionId: execution.id,
      status: succeeded ? "succeeded" : "provider_pending",
      response: result.response,
      providerJobId: result.providerJobId,
    });
    return { ...action, status: succeeded ? "succeeded" : "executing" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commerce cancellation failed.";
    if (isUnknownShopifyMutationOutcome(error) || (error instanceof WooCommerceRequestError && error.unknownMutationOutcome)) {
      await finalizeCommerceActionExecution({
        tenantId: input.tenantId,
        actionId: action.id,
        executionId: execution.id,
        status: "provider_pending",
        error: `${connection.provider === "woocommerce" ? "WooCommerce" : "Shopify"} is being checked before any retry is allowed.`,
      });
      return { ...action, status: "executing" };
    }
    await finalizeCommerceActionExecution({
      tenantId: input.tenantId,
      actionId: action.id,
      executionId: execution.id,
      status: "failed",
      error: message,
    });
    throw error;
  }
}
