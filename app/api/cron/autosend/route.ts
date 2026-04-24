/**
 * /api/cron/autosend
 *
 * Batch-sends all tickets in `pending_autosend` status for every tenant
 * that has autosend enabled and is within the send window.
 *
 * Called by Vercel Cron twice per day (08:00 and 16:00 UTC).
 * Secured by the same CRON_SECRET as the process-emails cron.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail, buildFromAddress } from "@/lib/resend";
import { buildOutboundMessageId } from "@/lib/email/outbound/messageId";
import { buildTenantInboundAddress } from "@/lib/email/inbound/address";
import { AUTO_SEND_PLANS, type Plan } from "@/lib/billing";

export const runtime    = "nodejs";
export const maxDuration = 60;

function isAutoSendPlan(plan: string | null | undefined): plan is Plan {
  return AUTO_SEND_PLANS.includes(plan as Plan);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

  const now        = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  function isWithinWindow(configuredTime: string | null | undefined): boolean {
    if (!configuredTime) return false;
    const [h, m] = configuredTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return false;
    // Modulo 1440 so slots near UTC-midnight (e.g. 23:55 UTC) don't
    // produce a negative diff when the cron fires at 00:05 UTC.
    const diff = ((nowMinutes - (h * 60 + m)) + 1440) % 1440;
    return diff >= 10 && diff <= 14;
  }

  // 1. Find all tenants with autosend enabled
  const { data: configs, error: cfgErr } = await supabase
    .from("tenant_agent_config")
    .select("tenant_id, autosend_threshold, autosend_time1:autosend_time_1, autosend_time2:autosend_time_2, sender_email, sender_name")
    .eq("autosend_enabled", true);

  if (cfgErr) {
    console.error("[autosend-cron] Failed to fetch configs:", cfgErr.message);
    return NextResponse.json({ error: cfgErr.message }, { status: 500 });
  }

  if (!configs?.length) {
    return NextResponse.json({ ok: true, message: "No tenants with autosend enabled", sent: 0 });
  }

  // Filter to eligible plans AND matching send window
  const eligibleConfigs: typeof configs = [];
  for (const cfg of configs) {
    const inWindow = isWithinWindow(cfg.autosend_time1) || isWithinWindow(cfg.autosend_time2);
    if (!inWindow) continue;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", cfg.tenant_id)
      .single();

    if (tenant && isAutoSendPlan(tenant.plan)) {
      eligibleConfigs.push(cfg);
    }
  }

  if (!eligibleConfigs.length) {
    return NextResponse.json({ ok: true, message: "No eligible tenants in window", sent: 0 });
  }

  const eligibleTenantIds = eligibleConfigs.map(c => c.tenant_id);
  const configMap = new Map(eligibleConfigs.map(c => [c.tenant_id, c]));
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

  let sent   = 0;
  let failed = 0;
  const errors: string[] = [];

  // ── 2a. Legacy tickets ──────────────────────────────────────────────────────
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, tenant_id, from_email, subject, gmail_thread_id, gmail_message_id, ai_draft")
    .eq("status", "pending_autosend")
    .in("tenant_id", eligibleTenantIds);

  for (const ticket of tickets ?? []) {
    try {
      const aiDraft = ticket.ai_draft as { body?: string } | null;
      const draftBody = aiDraft?.body ?? "";
      if (!draftBody) {
        await supabase
          .from("tickets")
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("id", ticket.id);
        errors.push(`${ticket.id}: no draft body, moved to draft`);
        failed++;
        continue;
      }

      const cfg  = configMap.get(ticket.tenant_id);
      const from = buildFromAddress(cfg?.sender_name, cfg?.sender_email);
      const subject = ticket.subject?.startsWith("Re:") ? ticket.subject : `Re: ${ticket.subject}`;

      const legacySendResult = await sendEmail({
        to:   ticket.from_email,
        from,
        subject,
        text: draftBody,
        inReplyTo:  ticket.gmail_message_id || undefined,
        references: ticket.gmail_thread_id
          ? `${ticket.gmail_thread_id} ${ticket.gmail_message_id ?? ""}`.trim()
          : ticket.gmail_message_id || undefined,
        replyTo:   replyToForTenant(ticket.tenant_id),
        messageId: buildOutboundMessageId(cfg?.sender_email ?? null),
      });

      await supabase
        .from("tickets")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", ticket.id);

      // Analytics: mark this as an auto-send so /api/analytics/overview can
      // distinguish autosend from manual approve+send. Without this row the
      // auto-resolve rate KPI is stuck at 0.
      const { error: legacyEventErr } = await supabase.from("support_events").insert({
        tenant_id:  ticket.tenant_id,
        request_id: legacySendResult?.id ?? null,
        source:     "resend",
        subject:    (ticket.subject ?? "").slice(0, 120),
        intent:     null,
        confidence: null,
        latency_ms: 0,
        draft_text: draftBody,
        outcome:    "autosend_sent",
      });
      if (legacyEventErr) {
        console.error(
          `[autosend-cron] support_events insert failed for ticket ${ticket.id}:`,
          legacyEventErr.message,
        );
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

  // ── 2b. AI-first conversations ──────────────────────────────────────────────
  const { data: conversations } = await supabase
    .from("support_conversations")
    .select("id, tenant_id, customer_email, subject_original, latest_decision_id, latest_inbound_message_id")
    .eq("status", "pending_autosend")
    .in("tenant_id", eligibleTenantIds);

  if (conversations?.length) {
    const decisionIds = conversations.map(c => c.latest_decision_id).filter(Boolean) as string[];
    const msgIds      = conversations.map(c => c.latest_inbound_message_id).filter(Boolean) as string[];

    const [{ data: decisions }, { data: inboundMsgs }] = await Promise.all([
      decisionIds.length
        ? supabase.from("support_decisions")
            .select("id, conversation_id, draft_body_original, intent, confidence")
            .in("id", decisionIds)
        : Promise.resolve({ data: [] as { id: string; conversation_id: string; draft_body_original: string; intent: string | null; confidence: number | null }[] }),
      msgIds.length
        ? supabase.from("support_messages")
            .select("id, conversation_id, internet_message_id, message_references")
            .in("id", msgIds)
        : Promise.resolve({ data: [] as { id: string; conversation_id: string; internet_message_id: string | null; message_references: string | null }[] }),
    ]);

    const decisionMap = new Map((decisions ?? []).map(d => [d.conversation_id, d]));
    const msgMap      = new Map((inboundMsgs ?? []).map(m => [m.conversation_id, m]));

    for (const conv of conversations) {
      try {
        const decision = decisionMap.get(conv.id);
        const draftBody = decision?.draft_body_original ?? "";
        if (!draftBody) {
          await supabase.from("support_conversations")
            .update({ status: "review", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          errors.push(`${conv.id}: no draft body, moved to review`);
          failed++;
          continue;
        }

        const cfg     = configMap.get(conv.tenant_id);
        const from    = buildFromAddress(cfg?.sender_name, cfg?.sender_email);
        const subject = (conv.subject_original ?? "").startsWith("Re:")
          ? conv.subject_original
          : `Re: ${conv.subject_original ?? ""}`;
        const msg = msgMap.get(conv.id);
        const outboundMessageId = buildOutboundMessageId(cfg?.sender_email ?? null);

        const sendResult = await sendEmail({
          to:         conv.customer_email,
          from,
          subject,
          text:       draftBody,
          inReplyTo:  msg?.internet_message_id ?? undefined,
          references: msg?.message_references ?? undefined,
          replyTo:    replyToForTenant(conv.tenant_id),
          messageId:  outboundMessageId,
        });

        // Record the outbound send so the thread view has full history AND so
        // the customer's follow-up can be threaded back to this conversation.
        await supabase.from("support_messages").insert({
          tenant_id:            conv.tenant_id,
          conversation_id:      conv.id,
          direction:            "outbound",
          provider:             "resend",
          provider_message_id:  sendResult.id ?? null,
          internet_message_id:  outboundMessageId,
          in_reply_to:          msg?.internet_message_id ?? null,
          message_references:   msg?.message_references ?? msg?.internet_message_id ?? null,
          from_email:           cfg?.sender_email ?? "",
          from_name:            cfg?.sender_name ?? null,
          to_email:             conv.customer_email,
          subject_original:     subject,
          body_original:        draftBody,
          sent_at:              new Date().toISOString(),
        });

        await supabase.from("support_conversations")
          .update({ status: "sent", latest_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", conv.id);

        // Analytics: mirror the legacy path so the auto-resolve KPI in
        // /api/analytics/overview also counts conversation-flow autosends.
        const { error: convEventErr } = await supabase.from("support_events").insert({
          tenant_id:  conv.tenant_id,
          request_id: sendResult?.id ?? null,
          source:     "resend",
          subject:    (conv.subject_original ?? "").slice(0, 120),
          intent:     decision?.intent ?? null,
          confidence: decision?.confidence ?? null,
          latency_ms: 0,
          draft_text: draftBody,
          outcome:    "autosend_sent",
        });
        if (convEventErr) {
          console.error(
            `[autosend-cron] support_events insert failed for conversation ${conv.id}:`,
            convEventErr.message,
          );
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

  console.log(`[autosend-cron] Done — ${sent} sent, ${failed} failed`);
  return NextResponse.json({ ok: true, sent, failed, errors });
}

export const GET  = handler;
export const POST = handler;
