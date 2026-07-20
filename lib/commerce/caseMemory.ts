import { customerKey } from "@/lib/commerce/identity";
import { buildPseudonymousCaseMemory } from "@/lib/commerce/memory";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function loadCaseMemoryContext(tenantId: string, email: string) {
  const { data, error } = await getSupabaseAdmin().from("case_memories").select("summary,closed_at")
    .eq("tenant_id", tenantId).eq("customer_key", customerKey(tenantId, email))
    .gt("expires_at", new Date().toISOString()).order("closed_at", { ascending: false }).limit(3);
  if (error) throw new Error(`Could not load case memory: ${error.message}`);
  return (data ?? []).map((memory) => ({ role: "case_memory", text: `${memory.summary} (closed ${memory.closed_at})` }));
}

export async function recordRepeatContact(input: { tenantId: string; conversationId: string; customerEmail: string; receivedAt: string }) {
  const supabase = getSupabaseAdmin();
  const initialReply = await supabase.from("support_messages").select("sent_at")
    .eq("tenant_id", input.tenantId).eq("conversation_id", input.conversationId).eq("direction", "outbound")
    .not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle();
  if (initialReply.error) throw new Error(`Could not inspect prior replies: ${initialReply.error.message}`);
  let lastOutbound = initialReply.data;
  if (!lastOutbound?.sent_at) {
    const { data: relatedConversations, error: relatedError } = await supabase.from("support_conversations").select("id")
      .eq("tenant_id", input.tenantId).ilike("customer_email", input.customerEmail).neq("id", input.conversationId).limit(20);
    if (relatedError) throw new Error(`Could not inspect related conversations: ${relatedError.message}`);
    const relatedIds = (relatedConversations ?? []).map((conversation) => conversation.id);
    if (relatedIds.length) {
      const previousReply = await supabase.from("support_messages").select("sent_at")
        .eq("tenant_id", input.tenantId).in("conversation_id", relatedIds).eq("direction", "outbound")
        .not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (previousReply.error) throw new Error(`Could not load the previous reply: ${previousReply.error.message}`);
      lastOutbound = previousReply.data;
    }
  }
  if (!lastOutbound?.sent_at) return;
  const elapsed = new Date(input.receivedAt).getTime() - new Date(lastOutbound.sent_at).getTime();
  if (elapsed < 0 || elapsed > 30 * 24 * 60 * 60 * 1000) return;
  const types = elapsed <= 7 * 24 * 60 * 60 * 1000 ? ["repeat_contact_7d", "repeat_contact_30d"] : ["repeat_contact_30d"];
  for (const outcomeType of types) {
    const { error } = await supabase.from("operational_outcomes").insert({
      tenant_id: input.tenantId, conversation_id: input.conversationId, outcome_type: outcomeType,
      metadata: { previousReplyAt: lastOutbound.sent_at, inboundAt: input.receivedAt }, occurred_at: input.receivedAt,
    });
    if (error) throw new Error(`Could not record repeat contact: ${error.message}`);
  }
}

export async function preserveCaseMemory(input: { tenantId: string; conversationId: string; customerEmail: string; closedAt: string }) {
  const supabase = getSupabaseAdmin();
  const [decisionResult, linkResult, outcomeResult] = await Promise.all([
    supabase.from("support_decisions").select("intent").eq("tenant_id", input.tenantId).eq("conversation_id", input.conversationId),
    supabase.from("conversation_entity_links").select("order_id").eq("tenant_id", input.tenantId).eq("conversation_id", input.conversationId).eq("link_status", "linked"),
    supabase.from("operational_outcomes").select("outcome_type").eq("tenant_id", input.tenantId).eq("conversation_id", input.conversationId).order("occurred_at", { ascending: false }),
  ]);
  if (decisionResult.error) throw new Error(`Could not load case decisions: ${decisionResult.error.message}`);
  if (linkResult.error) throw new Error(`Could not load case order links: ${linkResult.error.message}`);
  if (outcomeResult.error) throw new Error(`Could not load case outcomes: ${outcomeResult.error.message}`);
  const decisions = decisionResult.data;
  const links = linkResult.data;
  const outcomes = outcomeResult.data;
  const rawIntents = (decisions ?? []).map((decision) => decision.intent);
  const orderIds = (links ?? []).map((link) => link.order_id);
  const orderResult = orderIds.length
    ? await supabase.from("commerce_orders").select("display_name").eq("tenant_id", input.tenantId).in("id", orderIds)
    : { data: [] as Array<{ display_name: string }>, error: null };
  if (orderResult.error) throw new Error(`Could not load case orders: ${orderResult.error.message}`);
  const orders = orderResult.data;
  const linkedOrderCount = (orders ?? []).length;
  const memory = buildPseudonymousCaseMemory({
    rawIntents,
    linkedOrderCount,
    finalOutcome: outcomes?.[0]?.outcome_type ?? "case_closed",
  });
  const { error: memoryError } = await supabase.from("case_memories").upsert({
    tenant_id: input.tenantId, source_conversation_id: input.conversationId,
    customer_key: customerKey(input.tenantId, input.customerEmail), summary: memory.summary, intents: memory.intents, order_refs: [],
    final_outcome: memory.finalOutcome, closed_at: input.closedAt,
    expires_at: new Date(new Date(input.closedAt).getTime() + 730 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "source_conversation_id" });
  if (memoryError) throw new Error(`Could not preserve case memory: ${memoryError.message}`);
}
