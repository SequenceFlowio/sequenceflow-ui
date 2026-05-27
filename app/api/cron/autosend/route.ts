/**
 * /api/cron/autosend
 *
 * Sends queued replies for both modes:
 * - tenant-wide auto-send windows (`scheduled_send_at` is null)
 * - manually scheduled drafts (`scheduled_send_at` is due)
 */

import { NextResponse } from "next/server";

import { AUTO_SEND_PLANS, type Plan } from "@/lib/billing";
import { buildTenantInboundAddress } from "@/lib/email/inbound/address";
import { sendTenantEmail } from "@/lib/email/outbound/mailer";
import { buildOutboundMessageId } from "@/lib/email/outbound/messageId";
import { deleteScheduledAttachments, loadScheduledAttachments } from "@/lib/email/outbound/scheduledAttachments";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

type ConfigRow = {
  tenant_id: string;
  autosend_enabled: boolean | null;
  autosend_time1: string | null;
  autosend_time2: string | null;
  sender_email: string | null;
  sender_name: string | null;
};

type LegacyTicketRow = {
  id: string;
  tenant_id: string;
  from_email: string;
  subject: string | null;
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  ai_draft: unknown;
  scheduled_send_at: string | null;
};

type ConversationRow = {
  id: string;
  tenant_id: string;
  customer_email: string;
  subject_original: string | null;
  latest_decision_id: string | null;
  latest_inbound_message_id: string | null;
  scheduled_send_at: string | null;
};

type DecisionRow = {
  id: string;
  conversation_id: string;
  draft_body_original: string;
  intent: string | null;
  confidence: number | null;
};

type InboundMessageRow = {
  id: string;
  conversation_id: string;
  internet_message_id: string | null;
  message_references: string | null;
};

function isAutoSendPlan(plan: string | null | undefined): plan is Plan {
  return AUTO_SEND_PLANS.includes(plan as Plan);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function uniqueRowsById<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map(row => [row.id, row])).values());
}

async function handler(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ??
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  function isWithinWindow(configuredTime: string | null | undefined): boolean {
    if (!configuredTime) return false;
    const [h, m] = configuredTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return false;
    const diff = ((nowMinutes - (h * 60 + m)) + 1440) % 1440;
    return diff >= 10 && diff <= 14;
  }

  const { data: rawConfigs, error: cfgErr } = await supabase
    .from("tenant_agent_config")
    .select("tenant_id, autosend_enabled, autosend_time1:autosend_time_1, autosend_time2:autosend_time_2, sender_email, sender_name");

  if (cfgErr) {
    console.error("[autosend-cron] Failed to fetch configs:", cfgErr.message);
    return NextResponse.json({ error: cfgErr.message }, { status: 500 });
  }

  const configs = (rawConfigs ?? []) as ConfigRow[];
  const configMap = new Map(configs.map(c => [c.tenant_id, c]));
  const planCache = new Map<string, boolean>();

  async function isEligibleTenant(tenantId: string) {
    if (planCache.has(tenantId)) return planCache.get(tenantId) ?? false;
    const { data: tenant } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", tenantId)
      .single();
    const allowed = Boolean(tenant && isAutoSendPlan(tenant.plan));
    planCache.set(tenantId, allowed);
    return allowed;
  }

  const autoWindowTenantIds: string[] = [];
  for (const cfg of configs) {
    if (!cfg.autosend_enabled) continue;
    if (!isWithinWindow(cfg.autosend_time1) && !isWithinWindow(cfg.autosend_time2)) continue;
    if (await isEligibleTenant(cfg.tenant_id)) autoWindowTenantIds.push(cfg.tenant_id);
  }

  const [{ data: dueTicketTenants }, { data: dueConversationTenants }] = await Promise.all([
    supabase
      .from("tickets")
      .select("tenant_id")
      .eq("status", "pending_autosend")
      .lte("scheduled_send_at", nowIso),
    supabase
      .from("support_conversations")
      .select("tenant_id")
      .eq("status", "pending_autosend")
      .lte("scheduled_send_at", nowIso),
  ]);

  const dueScheduledTenantIds = Array.from(new Set([
    ...((dueTicketTenants ?? []) as { tenant_id: string }[]).map(row => row.tenant_id),
    ...((dueConversationTenants ?? []) as { tenant_id: string }[]).map(row => row.tenant_id),
  ]));

  const eligibleScheduledTenantIds: string[] = [];
  for (const tenantId of dueScheduledTenantIds) {
    if (await isEligibleTenant(tenantId)) eligibleScheduledTenantIds.push(tenantId);
  }

  const eligibleTenantIds = Array.from(new Set([...autoWindowTenantIds, ...eligibleScheduledTenantIds]));
  if (!eligibleTenantIds.length) {
    return NextResponse.json({ ok: true, message: "No eligible tenants due for sending", sent: 0 });
  }

  const { data: channels } = await supabase
    .from("tenant_email_channels")
    .select("tenant_id, inbound_address")
    .eq("is_default", true)
    .in("tenant_id", eligibleTenantIds);
  const inboundAddressMap = new Map(
    (channels ?? []).map((channel) => [channel.tenant_id, channel.inbound_address as string | null])
  );
  const replyToForTenant = (tenantId: string) =>
    inboundAddressMap.get(tenantId) || buildTenantInboundAddress(tenantId);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const fetchAutoTickets = async (): Promise<LegacyTicketRow[]> => {
    if (!autoWindowTenantIds.length) return [];
    const { data } = await supabase
      .from("tickets")
      .select("id, tenant_id, from_email, subject, gmail_thread_id, gmail_message_id, ai_draft, scheduled_send_at")
      .eq("status", "pending_autosend")
      .is("scheduled_send_at", null)
      .in("tenant_id", autoWindowTenantIds);
    return (data ?? []) as LegacyTicketRow[];
  };

  const fetchScheduledTickets = async (): Promise<LegacyTicketRow[]> => {
    if (!eligibleScheduledTenantIds.length) return [];
    const { data } = await supabase
      .from("tickets")
      .select("id, tenant_id, from_email, subject, gmail_thread_id, gmail_message_id, ai_draft, scheduled_send_at")
      .eq("status", "pending_autosend")
      .lte("scheduled_send_at", nowIso)
      .in("tenant_id", eligibleScheduledTenantIds);
    return (data ?? []) as LegacyTicketRow[];
  };

  const tickets = uniqueRowsById([...(await fetchAutoTickets()), ...(await fetchScheduledTickets())]);

  for (const ticket of tickets) {
    try {
      const isScheduledSend = Boolean(ticket.scheduled_send_at);
      const aiDraft = ticket.ai_draft as { body?: string } | null;
      const draftBody = aiDraft?.body ?? "";
      if (!draftBody) {
        await supabase
          .from("tickets")
          .update({ status: "draft", scheduled_send_at: null, updated_at: new Date().toISOString() })
          .eq("id", ticket.id);
        await deleteScheduledAttachments(supabase, { tenantId: ticket.tenant_id, ticketId: ticket.id });
        errors.push(`${ticket.id}: no draft body, moved to draft`);
        failed++;
        continue;
      }

      const cfg = configMap.get(ticket.tenant_id);
      const subject = ticket.subject?.startsWith("Re:") ? ticket.subject : `Re: ${ticket.subject ?? ""}`;
      const attachments = isScheduledSend
        ? await loadScheduledAttachments(supabase, { tenantId: ticket.tenant_id, ticketId: ticket.id })
        : [];

      const sendResult = await sendTenantEmail({
        tenantId: ticket.tenant_id,
        to: ticket.from_email,
        fromEmail: cfg?.sender_email ?? null,
        fromName: cfg?.sender_name ?? null,
        subject,
        text: draftBody,
        inReplyTo: ticket.gmail_message_id || undefined,
        references: ticket.gmail_thread_id
          ? `${ticket.gmail_thread_id} ${ticket.gmail_message_id ?? ""}`.trim()
          : ticket.gmail_message_id || undefined,
        replyTo: replyToForTenant(ticket.tenant_id),
        messageId: buildOutboundMessageId(cfg?.sender_email ?? null),
        attachments,
      });

      await supabase
        .from("tickets")
        .update({ status: "sent", scheduled_send_at: null, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      if (isScheduledSend) {
        await deleteScheduledAttachments(supabase, { tenantId: ticket.tenant_id, ticketId: ticket.id });
      }

      const { error: eventErr } = await supabase.from("support_events").insert({
        tenant_id: ticket.tenant_id,
        request_id: sendResult?.id ?? null,
        source: sendResult.provider,
        subject: (ticket.subject ?? "").slice(0, 120),
        intent: null,
        confidence: null,
        latency_ms: 0,
        draft_text: draftBody,
        outcome: isScheduledSend ? "scheduled_send_sent" : "autosend_sent",
      });
      if (eventErr) {
        console.error(`[autosend-cron] support_events insert failed for ticket ${ticket.id}:`, eventErr.message);
      }

      console.log(`[autosend-cron] Sent legacy ticket ${ticket.id}`);
      sent++;
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      console.error(`[autosend-cron] Failed legacy ticket ${ticket.id}:`, message);
      errors.push(`${ticket.id}: ${message}`);
      failed++;
    }
  }

  const fetchAutoConversations = async (): Promise<ConversationRow[]> => {
    if (!autoWindowTenantIds.length) return [];
    const { data } = await supabase
      .from("support_conversations")
      .select("id, tenant_id, customer_email, subject_original, latest_decision_id, latest_inbound_message_id, scheduled_send_at")
      .eq("status", "pending_autosend")
      .is("scheduled_send_at", null)
      .in("tenant_id", autoWindowTenantIds);
    return (data ?? []) as ConversationRow[];
  };

  const fetchScheduledConversations = async (): Promise<ConversationRow[]> => {
    if (!eligibleScheduledTenantIds.length) return [];
    const { data } = await supabase
      .from("support_conversations")
      .select("id, tenant_id, customer_email, subject_original, latest_decision_id, latest_inbound_message_id, scheduled_send_at")
      .eq("status", "pending_autosend")
      .lte("scheduled_send_at", nowIso)
      .in("tenant_id", eligibleScheduledTenantIds);
    return (data ?? []) as ConversationRow[];
  };

  const conversations = uniqueRowsById([
    ...(await fetchAutoConversations()),
    ...(await fetchScheduledConversations()),
  ]);

  if (conversations.length) {
    const decisionIds = conversations.map(c => c.latest_decision_id).filter(Boolean) as string[];
    const msgIds = conversations.map(c => c.latest_inbound_message_id).filter(Boolean) as string[];

    const [{ data: decisions }, { data: inboundMsgs }] = await Promise.all([
      decisionIds.length
        ? supabase.from("support_decisions")
            .select("id, conversation_id, draft_body_original, intent, confidence")
            .in("id", decisionIds)
        : Promise.resolve({ data: [] as DecisionRow[] }),
      msgIds.length
        ? supabase.from("support_messages")
            .select("id, conversation_id, internet_message_id, message_references")
            .in("id", msgIds)
        : Promise.resolve({ data: [] as InboundMessageRow[] }),
    ]);

    const decisionMap = new Map(((decisions ?? []) as DecisionRow[]).map(d => [d.conversation_id, d]));
    const msgMap = new Map(((inboundMsgs ?? []) as InboundMessageRow[]).map(m => [m.conversation_id, m]));

    for (const conv of conversations) {
      try {
        const isScheduledSend = Boolean(conv.scheduled_send_at);
        const decision = decisionMap.get(conv.id);
        const draftBody = decision?.draft_body_original ?? "";
        if (!draftBody) {
          await supabase.from("support_conversations")
            .update({ status: "review", scheduled_send_at: null, updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          await deleteScheduledAttachments(supabase, { tenantId: conv.tenant_id, conversationId: conv.id });
          errors.push(`${conv.id}: no draft body, moved to review`);
          failed++;
          continue;
        }

        const cfg = configMap.get(conv.tenant_id);
        const subject = (conv.subject_original ?? "").startsWith("Re:")
          ? conv.subject_original ?? ""
          : `Re: ${conv.subject_original ?? ""}`;
        const msg = msgMap.get(conv.id);
        const outboundMessageId = buildOutboundMessageId(cfg?.sender_email ?? null);
        const attachments = isScheduledSend
          ? await loadScheduledAttachments(supabase, { tenantId: conv.tenant_id, conversationId: conv.id })
          : [];

        const sendResult = await sendTenantEmail({
          tenantId: conv.tenant_id,
          to: conv.customer_email,
          fromEmail: cfg?.sender_email ?? null,
          fromName: cfg?.sender_name ?? null,
          subject,
          text: draftBody,
          inReplyTo: msg?.internet_message_id ?? undefined,
          references: msg?.message_references ?? undefined,
          replyTo: replyToForTenant(conv.tenant_id),
          messageId: outboundMessageId,
          attachments,
        });

        await supabase.from("support_messages").insert({
          tenant_id: conv.tenant_id,
          conversation_id: conv.id,
          direction: "outbound",
          provider: sendResult.provider,
          provider_message_id: sendResult.id ?? null,
          internet_message_id: outboundMessageId,
          in_reply_to: msg?.internet_message_id ?? null,
          message_references: msg?.message_references ?? msg?.internet_message_id ?? null,
          from_email: sendResult.fromEmail || cfg?.sender_email || "",
          from_name: sendResult.fromName ?? cfg?.sender_name ?? null,
          to_email: conv.customer_email,
          subject_original: subject,
          body_original: draftBody,
          sent_at: new Date().toISOString(),
        });

        await supabase.from("support_conversations")
          .update({
            status: "sent",
            scheduled_send_at: null,
            latest_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conv.id);
        if (isScheduledSend) {
          await deleteScheduledAttachments(supabase, { tenantId: conv.tenant_id, conversationId: conv.id });
        }

        const { error: eventErr } = await supabase.from("support_events").insert({
          tenant_id: conv.tenant_id,
          request_id: sendResult?.id ?? null,
          source: sendResult.provider,
          subject: (conv.subject_original ?? "").slice(0, 120),
          intent: decision?.intent ?? null,
          confidence: decision?.confidence ?? null,
          latency_ms: 0,
          draft_text: draftBody,
          outcome: isScheduledSend ? "scheduled_send_sent" : "autosend_sent",
        });
        if (eventErr) {
          console.error(`[autosend-cron] support_events insert failed for conversation ${conv.id}:`, eventErr.message);
        }

        console.log(`[autosend-cron] Sent conversation ${conv.id}`);
        sent++;
      } catch (e: unknown) {
        const message = getErrorMessage(e);
        console.error(`[autosend-cron] Failed conversation ${conv.id}:`, message);
        errors.push(`${conv.id}: ${message}`);
        failed++;
      }
    }
  }

  console.log(`[autosend-cron] Done - ${sent} sent, ${failed} failed`);
  return NextResponse.json({ ok: true, sent, failed, errors });
}

export const GET = handler;
export const POST = handler;
