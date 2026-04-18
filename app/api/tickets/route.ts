import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { TicketListItem } from "@/types/aiInbox";

function isInboundAddress(email: string | null, tenantId: string): boolean {
  if (!email) return false;
  const domain = process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.emailreply.sequenceflow.io";
  return email.endsWith(`@${domain}`) || email.toLowerCase() === `t-${tenantId}@${domain}`;
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  const supabase = getSupabaseAdmin();

  const [{ data: conversations }, { data: legacyTickets }] = await Promise.all([
    supabase
      .from("support_conversations")
      .select("id, status, customer_email, customer_name, subject_original, subject_english, latest_decision_id, latest_message_at")
      .eq("tenant_id", tenantId)
      .order("latest_message_at", { ascending: false }),
    supabase
      .from("tickets")
      .select("id, from_email, from_name, subject, body_text, intent, confidence, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  const decisionIds = (conversations ?? [])
    .map((conversation) => conversation.latest_decision_id)
    .filter(Boolean) as string[];

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
  const [{ data: decisions }, { data: messages }] = await Promise.all([
    decisionIds.length
      ? supabase
          .from("support_decisions")
          .select("id, conversation_id, intent, confidence, decision, requires_human, draft_body_original, draft_body_english")
          .in("id", decisionIds)
      : Promise.resolve({ data: [], error: null }),
    conversationIds.length
      ? supabase
          .from("support_messages")
          .select("conversation_id, body_original, body_english")
          .eq("direction", "inbound")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const decisionMap = new Map((decisions ?? []).map((decision) => [decision.conversation_id, decision]));
  const messageMap = new Map<string, { body_original: string | null; body_english: string | null }>();
  for (const message of messages ?? []) {
    if (!messageMap.has(message.conversation_id)) {
      messageMap.set(message.conversation_id, message);
    }
  }

  const newItems: TicketListItem[] = (conversations ?? []).map((conversation) => {
    const decision = decisionMap.get(conversation.id);
    const message = messageMap.get(conversation.id);
    return {
      id: conversation.id,
      source: "conversation",
      customerEmail: isInboundAddress(conversation.customer_email, tenantId) ? null : conversation.customer_email,
      customerName: conversation.customer_name,
      subject: conversation.subject_original,
      subjectEnglish: conversation.subject_english,
      preview: message?.body_original ?? decision?.draft_body_original ?? null,
      previewEnglish: message?.body_english ?? decision?.draft_body_english ?? null,
      intent: decision?.intent ?? null,
      confidence: decision?.confidence != null ? Number(decision.confidence) : null,
      decision: decision?.decision ?? null,
      requiresHuman: Boolean(decision?.requires_human ?? true),
      status: conversation.status,
      updatedAt: conversation.latest_message_at,
    };
  });

  const legacyItems: TicketListItem[] = (legacyTickets ?? []).map((ticket) => ({
    id: ticket.id,
    source: "legacy",
    customerEmail: isInboundAddress(ticket.from_email, tenantId) ? null : ticket.from_email,
    customerName: ticket.from_name,
    subject: ticket.subject,
    subjectEnglish: null,
    preview: ticket.body_text,
    previewEnglish: null,
    intent: ticket.intent,
    confidence: ticket.confidence != null ? Number(ticket.confidence) : null,
    decision: null,
    requiresHuman: true,
    status: ticket.status,
    updatedAt: ticket.created_at,
  }));

  const items = [...newItems, ...legacyItems].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json({ tickets: items });
}
