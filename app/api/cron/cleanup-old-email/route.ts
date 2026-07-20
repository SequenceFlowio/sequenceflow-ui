import { NextResponse } from "next/server";

import { deleteInboundAttachmentsForConversation } from "@/lib/email/inbound/messageAttachments";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { preserveCaseMemory } from "@/lib/commerce/caseMemory";

export const runtime = "nodejs";
export const maxDuration = 60;

const RETENTION_DAYS = 90;
const EVENT_RETENTION_DAYS = 90;
const FINAL_CONVERSATION_STATUSES = ["sent", "closed", "ignored", "escalated", "archived"];
const FINAL_TICKET_STATUSES = ["sent", "ignored", "escalated", "archived"];
const CONVERSATION_BATCH_SIZE = 200;
const LEGACY_TICKET_BATCH_SIZE = 500;

function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ??
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");

  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

async function handler(req: Request) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const eventCutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversations, error: conversationLookupError } = await supabase
    .from("support_conversations")
    .select("id,tenant_id,customer_email,latest_message_at")
    .in("status", FINAL_CONVERSATION_STATUSES)
    .lt("latest_message_at", cutoff)
    .neq("retention_exempt", true)
    .limit(CONVERSATION_BATCH_SIZE);

  if (conversationLookupError) {
    console.error("[cleanup-old-email] conversation lookup", conversationLookupError);
    return NextResponse.json({ error: conversationLookupError.message }, { status: 500 });
  }

  const conversationIds: string[] = [];
  let skippedConversations = 0;
  for (const conversation of conversations ?? []) {
    try {
      await preserveCaseMemory({ tenantId: conversation.tenant_id, conversationId: conversation.id, customerEmail: conversation.customer_email, closedAt: conversation.latest_message_at });
      await deleteInboundAttachmentsForConversation(supabase, conversation.id);
      conversationIds.push(conversation.id);
    } catch (error) {
      skippedConversations += 1;
      console.error("[cleanup-old-email/preserve-case]", conversation.id, error);
    }
  }

  const { error: conversationsError, count: conversationsCount } = conversationIds.length
    ? await supabase
        .from("support_conversations")
        .delete({ count: "exact" })
        .in("id", conversationIds)
    : { error: null, count: 0 };

  if (conversationsError) {
    console.error("[cleanup-old-email] conversations", conversationsError);
    return NextResponse.json({ error: conversationsError.message }, { status: 500 });
  }

  const { data: tickets, error: ticketLookupError } = await supabase
    .from("tickets")
    .select("id")
    .in("status", FINAL_TICKET_STATUSES)
    .lt("updated_at", cutoff)
    .neq("retention_exempt", true)
    .limit(LEGACY_TICKET_BATCH_SIZE);

  if (ticketLookupError) {
    console.error("[cleanup-old-email] ticket lookup", ticketLookupError);
    return NextResponse.json({ error: ticketLookupError.message }, { status: 500 });
  }

  const ticketIds = (tickets ?? []).map((row) => row.id as string);
  const { error: ticketsError, count: ticketsCount } = ticketIds.length
    ? await supabase
        .from("tickets")
        .delete({ count: "exact" })
        .in("id", ticketIds)
    : { error: null, count: 0 };

  if (ticketsError) {
    console.error("[cleanup-old-email] tickets", ticketsError);
    return NextResponse.json({ error: ticketsError.message }, { status: 500 });
  }

  const { error: supportEventsError, count: supportEventsCount } = await supabase
    .from("support_events")
    .delete({ count: "exact" })
    .lt("created_at", eventCutoff);

  if (supportEventsError) {
    console.error("[cleanup-old-email] support events", supportEventsError);
    return NextResponse.json({ error: supportEventsError.message }, { status: 500 });
  }

  const { error: marketingEventsError, count: marketingEventsCount } = await supabase
    .from("marketing_events")
    .delete({ count: "exact" })
    .lt("created_at", eventCutoff);

  if (marketingEventsError && marketingEventsError.code !== "42P01") {
    console.error("[cleanup-old-email] marketing events", marketingEventsError);
    return NextResponse.json({ error: marketingEventsError.message }, { status: 500 });
  }

  const { data: prunedCommerceOrders, error: commerceRetentionError } = await supabase.rpc("prune_expired_commerce_orders", {
    p_cutoff: cutoff,
  });
  if (commerceRetentionError) {
    console.error("[cleanup-old-email] commerce retention", commerceRetentionError);
    return NextResponse.json({ error: commerceRetentionError.message }, { status: 500 });
  }

  const rawContentCleanup = await Promise.all([
    supabase.from("translation_cache").delete().lt("created_at", cutoff),
    supabase.from("mined_exchanges").delete().lt("created_at", cutoff),
  ]);
  const rawContentError = rawContentCleanup.find((result) => result.error)?.error;
  if (rawContentError) {
    console.error("[cleanup-old-email] raw derived content", rawContentError);
    return NextResponse.json({ error: rawContentError.message }, { status: 500 });
  }

  const longTermCutoff = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
  const { data: prunedCommerceActions, error: actionRetentionError } = await supabase.rpc("prune_expired_commerce_actions", {
    p_cutoff: longTermCutoff,
  });
  if (actionRetentionError) {
    console.error("[cleanup-old-email] commerce action retention", actionRetentionError);
    return NextResponse.json({ error: actionRetentionError.message }, { status: 500 });
  }
  const longTermCleanup = await Promise.all([
    supabase.from("case_memories").delete().lt("expires_at", nowIsoSafe()),
    supabase.from("operational_outcomes").delete().lt("occurred_at", longTermCutoff),
    supabase.from("commerce_events").delete().lt("occurred_at", longTermCutoff),
    supabase.from("operational_metrics_daily").delete().lt("metric_date", longTermCutoff.slice(0, 10)),
    supabase.from("profile_learning_events").delete().lt("created_at", longTermCutoff),
    supabase.from("commerce_audit_events").delete().lt("created_at", longTermCutoff),
  ]);
  const longTermError = longTermCleanup.find((result) => result.error)?.error;
  if (longTermError) {
    console.error("[cleanup-old-email] long-term retention", longTermError);
    return NextResponse.json({ error: longTermError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    retentionDays: RETENTION_DAYS,
    eventRetentionDays: EVENT_RETENTION_DAYS,
    cutoff,
    deleted: {
      conversations: conversationsCount ?? 0,
      skippedConversations,
      tickets: ticketsCount ?? 0,
      supportEvents: supportEventsCount ?? 0,
      marketingEvents: marketingEventsCount ?? 0,
      commerceOrders: Number(prunedCommerceOrders ?? 0),
      commerceActions: Number(prunedCommerceActions ?? 0),
    },
  });
}

function nowIsoSafe() {
  return new Date().toISOString();
}

export const GET = handler;
export const POST = handler;
