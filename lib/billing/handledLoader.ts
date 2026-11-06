import { currentUsagePeriodStart } from "@/lib/billingPlans";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import {
  assessConversation,
  budgetLevel,
  includedHandled,
  isThanksOnly,
  summarizePeriod,
  type ConversationEvidence,
  type HandledResult,
  type ReplyKind,
  type ReplyPurpose,
} from "./handledConversations";

const LOOKBACK_MS = 4 * 24 * 60 * 60 * 1000;

/** De afhandeling per gesprek, voor gesprekken met een antwoord sinds `since` (min. 4 dagen terug door de 72 uur). */
export async function loadConversationResults(tenantId: string, since: Date, now: Date = new Date()) {
  const supabase = getSupabaseAdmin();
  const { data: recent, error: recentError } = await supabase
    .from("support_messages")
    .select("conversation_id")
    .eq("tenant_id", tenantId)
    .eq("direction", "outbound")
    .gte("sent_at", new Date(since.getTime() - LOOKBACK_MS).toISOString());
  if (recentError) throw new Error(`recent replies: ${recentError.message}`);
  const ids = [...new Set((recent ?? []).map((row) => row.conversation_id as string))];
  if (!ids.length) return [] as { conversationId: string; result: HandledResult }[];

  const [{ data: messages, error: messagesError }, { data: conversations, error: conversationsError }] = await Promise.all([
    supabase.from("support_messages").select("conversation_id, direction, sent_at, received_at, created_at, metadata, body_original").eq("tenant_id", tenantId).in("conversation_id", ids),
    supabase.from("support_conversations").select("id, spammed_at").eq("tenant_id", tenantId).in("id", ids),
  ]);
  if (messagesError) throw new Error(`messages: ${messagesError.message}`);
  if (conversationsError) throw new Error(`conversations: ${conversationsError.message}`);

  const evidence = new Map<string, ConversationEvidence>();
  for (const conversation of conversations ?? []) {
    evidence.set(conversation.id, { conversationId: conversation.id, spam: Boolean(conversation.spammed_at), replies: [], customerMessages: [] });
  }
  for (const message of messages ?? []) {
    const item = evidence.get(message.conversation_id as string);
    if (!item) continue;
    if (message.direction === "outbound") {
      const meta = (message.metadata ?? {}) as { reply_kind?: string; reply_purpose?: string };
      const kind = meta.reply_kind === "ai_assisted" || meta.reply_kind === "ai_autonomous" ? (meta.reply_kind as ReplyKind) : null;
      const purpose: ReplyPurpose = meta.reply_purpose === "question" ? "question" : "answer";
      const sentAt = (message.sent_at ?? message.created_at) as string | null;
      if (sentAt) item.replies.push({ sentAt, kind, purpose });
    } else {
      // Een kaal bedankje is geen terugkomen: het gesprek is dan juist opgelost.
      if (isThanksOnly(message.body_original as string | null)) continue;
      const receivedAt = (message.received_at ?? message.created_at) as string | null;
      if (receivedAt) item.customerMessages.push(receivedAt);
    }
  }
  return [...evidence.values()].map((item) => ({ conversationId: item.conversationId, result: assessConversation(item, now) }));
}

/**
 * Het overzicht voor de klant: wat er deze periode is afgehandeld, wat nog
 * in controle is, wat het kost en hoe dat zich verhoudt tot het budget.
 */
export async function loadHandledSummary(tenantId: string, now: Date = new Date()) {
  const supabase = getSupabaseAdmin();
  const { data: tenant, error: tenantError } = await supabase.from("tenants").select("plan, billing_period_start, usage_budget_cents").eq("id", tenantId).single();
  if (tenantError) throw new Error(`tenant: ${tenantError.message}`);
  const start = new Date(currentUsagePeriodStart(tenant?.billing_period_start, now));
  const results = (await loadConversationResults(tenantId, start, now)).map((item) => item.result);
  const summary = summarizePeriod(results, { start, end: new Date(now.getTime() + 1) }, includedHandled(tenant?.plan as string | null));

  // Wat er echt op de factuur komt (of al stond), staat in het register.
  const { data: ledger, error: ledgerError } = await supabase
    .from("billing_handled_conversations")
    .select("rate_cents, status")
    .eq("tenant_id", tenantId)
    .gte("final_at", start.toISOString());
  if (ledgerError) throw new Error(`ledger: ${ledgerError.message}`);
  const billedCents = (ledger ?? []).filter((row) => row.status === "reported" || row.status === "pending_report").reduce((sum, row) => sum + (row.rate_cents as number), 0);
  const overBudget = (ledger ?? []).filter((row) => row.status === "over_budget").length;
  const budgetCents = (tenant?.usage_budget_cents as number | null) ?? null;

  return { periodStart: start.toISOString(), ...summary, billedCents, overBudget, budgetCents, budget: budgetLevel(billedCents, budgetCents) };
}
