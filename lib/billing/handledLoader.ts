import { currentUsagePeriodStart } from "@/lib/billingPlans";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { assessConversation, summarizePeriod, type ConversationEvidence, type ReplyKind, type ReplyPurpose } from "./handledConversations";

const LOOKBACK_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Afgehandelde gesprekken van één werkruimte in de lopende periode. Alleen
 * lezen: er wordt niets opgeslagen of gefactureerd.
 */
export async function loadHandledSummary(tenantId: string, now: Date = new Date()) {
  const supabase = getSupabaseAdmin();
  const { data: tenant, error: tenantError } = await supabase.from("tenants").select("billing_period_start").eq("id", tenantId).single();
  if (tenantError) throw new Error(`tenant: ${tenantError.message}`);
  const start = new Date(currentUsagePeriodStart(tenant?.billing_period_start, now));

  // Gesprekken met een antwoord dat in deze periode (of net ervoor, door de 72 uur) is verstuurd.
  const { data: recent, error: recentError } = await supabase
    .from("support_messages")
    .select("conversation_id")
    .eq("tenant_id", tenantId)
    .eq("direction", "outbound")
    .gte("sent_at", new Date(start.getTime() - LOOKBACK_MS).toISOString());
  if (recentError) throw new Error(`recent replies: ${recentError.message}`);
  const ids = [...new Set((recent ?? []).map((row) => row.conversation_id as string))];
  if (!ids.length) return { periodStart: start.toISOString(), ...summarizePeriod([], { start, end: now }) };

  const [{ data: messages, error: messagesError }, { data: conversations, error: conversationsError }] = await Promise.all([
    supabase.from("support_messages").select("conversation_id, direction, sent_at, received_at, created_at, metadata").eq("tenant_id", tenantId).in("conversation_id", ids),
    supabase.from("support_conversations").select("id, spammed_at, status").eq("tenant_id", tenantId).in("id", ids),
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
      const receivedAt = (message.received_at ?? message.created_at) as string | null;
      if (receivedAt) item.customerMessages.push(receivedAt);
    }
  }

  const results = [...evidence.values()].map((item) => assessConversation(item, now));
  return { periodStart: start.toISOString(), ...summarizePeriod(results, { start, end: new Date(now.getTime() + 1) }) };
}
