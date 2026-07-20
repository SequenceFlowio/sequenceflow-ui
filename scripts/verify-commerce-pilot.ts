import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { decryptSecret } from "../lib/security/credentials.ts";
import { WOO_ACTION_META_KEY } from "../lib/commerce/woocommerce.ts";

const REQUIRED_WEBHOOKS = ["order.created", "order.updated", "order.deleted"];
function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required.`); return value; }
async function woo<T>(connection: Record<string, unknown>, path: string): Promise<T> {
  const response = await fetch(`${String(connection.shop_domain).replace(/\/$/, "")}/wp-json/wc/v3/${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${connection.client_id}:${decryptSecret(String(connection.client_secret_encrypted))}`).toString("base64")}`, Accept: "application/json" } });
  const payload = await response.json().catch(() => ({})); assert.ok(response.ok, (payload as { message?: string }).message || `WooCommerce verification failed (${response.status}).`); return payload as T;
}

async function main() {
  const tenantId = required("PILOT_TENANT_ID"); const conversationId = required("PILOT_CONVERSATION_ID");
  const supabase = createClient(process.env.SUPABASE_URL?.trim() || required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const connectionResult = await supabase.from("commerce_connections").select("*").eq("tenant_id", tenantId).eq("provider", "woocommerce").single(); assert.ifError(connectionResult.error);
  const connection = connectionResult.data; assert.equal(connection.status, "active"); assert.equal(connection.action_mode, "approval_required"); assert.deepEqual([...connection.scopes].sort(), ["read_orders", "write_orders"]);
  const conversationResult = await supabase.from("support_conversations").select("latest_decision_id").eq("tenant_id", tenantId).eq("id", conversationId).single(); assert.ifError(conversationResult.error);
  const decisionResult = await supabase.from("support_decisions").select("blocking_action_id").eq("tenant_id", tenantId).eq("id", conversationResult.data.latest_decision_id).single(); assert.ifError(decisionResult.error);
  const actionResult = await supabase.from("commerce_action_proposals").select("*").eq("tenant_id", tenantId).eq("id", decisionResult.data.blocking_action_id).single(); assert.ifError(actionResult.error);
  const action = actionResult.data; assert.equal(action.status, "succeeded"); assert.ok(action.approved_by && action.approved_at && action.completed_at);
  const [links, orderResult, executions, outcomes, outbound] = await Promise.all([
    supabase.from("conversation_entity_links").select("order_id,link_status").eq("tenant_id", tenantId).eq("conversation_id", conversationId),
    supabase.from("commerce_orders").select("*").eq("tenant_id", tenantId).eq("id", action.order_id).single(),
    supabase.from("commerce_action_executions").select("status,request_data,response_data,error").eq("tenant_id", tenantId).eq("proposal_id", action.id).order("attempt"),
    supabase.from("operational_outcomes").select("outcome_type").eq("tenant_id", tenantId).eq("conversation_id", conversationId),
    supabase.from("support_messages").select("created_at").eq("tenant_id", tenantId).eq("conversation_id", conversationId).eq("direction", "outbound"),
  ]); for (const result of [links, orderResult, executions, outcomes, outbound]) assert.ifError(result.error);
  const linked = (links.data ?? []).filter((link) => link.link_status === "linked"); assert.equal(linked.length, 1); assert.equal(linked[0].order_id, action.order_id);
  const order = orderResult.data; const mutations = (executions.data ?? []).filter((execution) => execution.request_data?.orderId === order.external_id); assert.equal(mutations.length, 1); assert.equal(mutations[0].status, "succeeded");
  for (const type of ["action_proposed", "action_approved", "action_succeeded", "reply_sent"]) assert.equal((outcomes.data ?? []).filter((item) => item.outcome_type === type).length, 1, `Expected one ${type}`);
  assert.ok((outbound.data ?? []).some((message) => new Date(message.created_at) >= new Date(action.completed_at)), "No reply was sent after provider success.");

  const [liveOrder, refunds, webhooks] = await Promise.all([
    woo<{ status: string; total: string }>(connection, `orders/${order.external_id}`),
    woo<Array<{ id: number; amount: string; meta_data?: Array<{ key: string; value: unknown }> }>>(connection, `orders/${order.external_id}/refunds`),
    woo<Array<{ topic: string; delivery_url: string; status: string }>>(connection, "webhooks?per_page=100&status=all"),
  ]);
  const refundedAmount = refunds.reduce((sum, refund) => sum + Math.abs(Number(refund.amount || 0)), 0);
  assert.equal(liveOrder.status, "cancelled"); assert.ok(refundedAmount >= Number(liveOrder.total), "WooCommerce does not report a full refund.");
  const actionRefunds = refunds.filter((refund) => refund.meta_data?.some((meta) => meta.key === WOO_ACTION_META_KEY && meta.value === action.action_fingerprint)); assert.equal(actionRefunds.length, 1, "Expected exactly one fingerprinted WooCommerce refund.");
  const callback = `${required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/api/integrations/woocommerce/webhook`;
  const topics = new Set(webhooks.filter((hook) => hook.delivery_url === callback && hook.status === "active").map((hook) => hook.topic)); for (const topic of REQUIRED_WEBHOOKS) assert.ok(topics.has(topic), `Missing WooCommerce webhook: ${topic}`);
  console.log(JSON.stringify({ ok: true, conversationId, order: order.display_name, actionStatus: action.status, providerMutations: mutations.length, refundId: actionRefunds[0].id, refundedAmount, wooCommerceStatus: liveOrder.status, registeredWebhooks: [...topics].sort(), manualEvidenceStillRequired: ["Payment gateway refund confirmation", "Inventory count before and after restock"] }, null, 2));
}
main().catch((error) => { console.error(`Commerce pilot verification failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
