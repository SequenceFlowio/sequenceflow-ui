import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extractVisibleReplyText } from "@/lib/email/inbound/replyText";
import { deleteInboundAttachmentsForConversation, loadMessageAttachmentViews } from "@/lib/email/inbound/messageAttachments";
import type { TicketDetailResponse } from "@/types/aiInbox";
import { loadConversationCommerce } from "@/lib/commerce/resolution";

export const runtime = "nodejs";
// Always hit the database — this endpoint is per-user, per-tenant, and
// reflects live state that can change server-side (DB backfills, inbound
// webhook updates). Never serve a cached snapshot.
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (conversation) {
    if (conversation.status !== "archived") {
      return NextResponse.json({ error: "Archive the conversation before deleting it." }, { status: 409 });
    }
    await deleteInboundAttachmentsForConversation(supabase, id);
    await supabase.from("support_decisions").delete().eq("conversation_id", id).eq("tenant_id", tenantId);
    await supabase.from("support_messages").delete().eq("conversation_id", id).eq("tenant_id", tenantId);
    await supabase.from("support_conversations").delete().eq("id", id).eq("tenant_id", tenantId);
    return NextResponse.json({ ok: true });
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status !== "archived") {
    return NextResponse.json({ error: "Archive the ticket before deleting it." }, { status: 409 });
  }

  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let tenantId: string;
  let viewerRole: "admin" | "agent";
  try {
    const context = await getTenantId(req);
    tenantId = context.tenantId;
    viewerRole = context.role === "admin" ? "admin" : "agent";
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  const supabase = getSupabaseAdmin();

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, status, scheduled_send_at, customer_email, customer_name, subject_original, subject_english, latest_decision_id, created_at, retention_exempt")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (conversation) {
    const [{ data: decision }, { data: messages }] = await Promise.all([
      conversation.latest_decision_id
        ? supabase
            .from("support_decisions")
            .select("*")
            .eq("id", conversation.latest_decision_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true }),
    ]);
    const attachmentMap = await loadMessageAttachmentViews(supabase, {
      tenantId,
      messageIds: (messages ?? []).map((message) => message.id),
    });

    const [commerceContext, actionResult, linkResult, outcomeResult] = await Promise.all([
      loadConversationCommerce({ tenantId, conversationId: conversation.id, customerEmail: conversation.customer_email }).catch(() => null),
      decision?.blocking_action_id
        ? supabase.from("commerce_action_proposals").select("*").eq("id", decision.blocking_action_id).eq("tenant_id", tenantId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("conversation_entity_links").select("order_id,link_status,match_method,confidence,confirmed_at").eq("tenant_id", tenantId).eq("conversation_id", conversation.id),
      supabase.from("operational_outcomes").select("id,outcome_type,occurred_at,metadata").eq("tenant_id", tenantId).eq("conversation_id", conversation.id).order("occurred_at", { ascending: false }).limit(30),
    ]);
    const blockingActionRow = actionResult.data;
    const blockingOrder = blockingActionRow?.order_id ? await supabase.from("commerce_orders").select("display_name,total_amount,currency_code").eq("id", blockingActionRow.order_id).eq("tenant_id", tenantId).maybeSingle() : { data: null };
    const orderSnapshot = blockingActionRow?.order_snapshot as { orderId?: string; displayName?: string; totalAmount?: number; currencyCode?: string } | null;
    const blockingOrderView = blockingOrder.data ?? (orderSnapshot?.displayName ? {
      display_name: orderSnapshot.displayName,
      total_amount: orderSnapshot.totalAmount ?? 0,
      currency_code: orderSnapshot.currencyCode ?? "EUR",
    } : null);
    const [commerceEventsResult, executionsResult, actionAuditResult, orderAuditResult] = await Promise.all([
      commerceContext?.order
        ? supabase.from("commerce_events").select("id,topic,status,occurred_at").eq("tenant_id", tenantId).eq("order_id", commerceContext.order.id).order("occurred_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
      blockingActionRow
        ? supabase.from("commerce_action_executions").select("id,status,started_at").eq("tenant_id", tenantId).eq("proposal_id", blockingActionRow.id).order("started_at", { ascending: false }).limit(10)
        : Promise.resolve({ data: [] }),
      blockingActionRow
        ? supabase.from("commerce_audit_events").select("id,event_type,created_at").eq("tenant_id", tenantId).eq("target_type", "action").eq("target_id", blockingActionRow.id).order("created_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
      commerceContext?.order
        ? supabase.from("commerce_audit_events").select("id,event_type,created_at").eq("tenant_id", tenantId).eq("target_type", "order_link").eq("target_id", commerceContext.order.id).order("created_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
    ]);

    const escalationAction = Array.isArray(decision?.actions)
      ? decision.actions.find(
          (action: unknown): action is { type: "ESCALATE_TO_DEPARTMENT"; payload?: { department?: string } } =>
            typeof action === "object" && action !== null &&
            (action as { type?: unknown }).type === "ESCALATE_TO_DEPARTMENT"
        )
      : null;

    const payload: TicketDetailResponse = {
      id: conversation.id,
      viewerRole,
      source: "conversation",
      status: conversation.status,
      scheduledSendAt: conversation.scheduled_send_at ?? null,
      createdAt: conversation.created_at ?? null,
      retentionExempt: Boolean(conversation.retention_exempt),
      customer: {
        email: conversation.customer_email,
        name: conversation.customer_name,
      },
      subject: conversation.subject_original,
      subjectEnglish: conversation.subject_english,
      intent: decision?.intent ?? null,
      confidence: decision?.confidence != null ? Number(decision.confidence) : null,
      decision: decision?.decision ?? null,
      requiresHuman: Boolean(decision?.requires_human ?? true),
      reasons: Array.isArray(decision?.reasons) ? decision.reasons : [],
      draft: decision
        ? {
            original: {
              subject: decision.draft_subject_original,
              body: decision.draft_body_original,
              language: decision.draft_language,
            },
            english: {
              subject: decision.draft_subject_english,
              body: decision.draft_body_english,
            },
          }
        : null,
      messages: (messages ?? []).map((message) => ({
        direction: message.direction,
        fromEmail: message.from_email,
        toEmail: message.to_email,
        receivedAt: message.received_at ?? message.created_at ?? null,
        original: {
          subject: message.subject_original,
          body: message.direction === "inbound" ? extractVisibleReplyText(message.body_original) : message.body_original ?? "",
          language: message.language_original ?? null,
        },
        english: {
          subject: message.subject_english ?? null,
          body: message.direction === "inbound" && message.body_english ? extractVisibleReplyText(message.body_english) : message.body_english ?? null,
        },
        attachments: attachmentMap.get(message.id) ?? [],
      })),
      escalation: decision?.review_status === "escalated"
        ? {
            department: escalationAction?.payload?.department ?? null,
            reason: Array.isArray(decision.reasons) && decision.reasons.length > 0 ? String(decision.reasons[0]) : null,
          }
        : null,
      commerceContext,
      entityLinks: (linkResult.data ?? []).map((link) => ({ orderId: link.order_id, status: link.link_status, matchMethod: link.match_method, confidence: Number(link.confidence), confirmedAt: link.confirmed_at ?? null })),
      blockingAction: blockingActionRow && blockingOrderView ? {
        id: blockingActionRow.id,
        type: "cancel_order",
        status: blockingActionRow.status,
        rationale: blockingActionRow.rationale,
        riskLevel: blockingActionRow.risk_level,
        orderId: blockingActionRow.order_id ?? orderSnapshot?.orderId ?? "",
        orderDisplayName: blockingOrderView.display_name,
        totalAmount: Number(blockingOrderView.total_amount),
        currencyCode: blockingOrderView.currency_code,
        parameters: { refundOriginalPayment: true, restock: true, notifyCustomer: false },
        lastError: blockingActionRow.last_error ?? null,
        confirmationStatus: blockingActionRow.confirmation_status ?? "pending",
        confirmationError: blockingActionRow.confirmation_error ?? null,
      } : null,
      operationalTimeline: [
        ...(outcomeResult.data ?? []).map((outcome) => ({ id: outcome.id, type: outcome.outcome_type, label: String(outcome.outcome_type).replace(/_/g, " "), occurredAt: outcome.occurred_at })),
        ...(commerceEventsResult.data ?? []).map((event) => ({ id: event.id, type: "commerce_event", status: event.status, label: `Commerce ${String(event.topic).toLowerCase().replace(/_/g, " ")}`, occurredAt: event.occurred_at })),
        ...(executionsResult.data ?? []).map((execution) => ({ id: execution.id, type: "action_execution", status: execution.status, label: `Cancellation execution: ${execution.status}`, occurredAt: execution.started_at })),
        ...(actionAuditResult.data ?? []).map((event) => ({ id: event.id, type: "audit_event", label: String(event.event_type).replace(/_/g, " "), occurredAt: event.created_at })),
        ...(orderAuditResult.data ?? []).map((event) => ({ id: event.id, type: "audit_event", label: String(event.event_type).replace(/_/g, " "), occurredAt: event.created_at })),
      ].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
    };

    return NextResponse.json(payload);
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, subject, from_email, from_name, intent, confidence, body_text, ai_draft, status, scheduled_send_at, escalation_reason, escalation_department, retention_exempt")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const aiDraft = ticket.ai_draft as { subject?: string; body?: string } | string | null;
  const draftSubject = typeof aiDraft === "string" ? ticket.subject : aiDraft?.subject ?? ticket.subject;
  const draftBody = typeof aiDraft === "string" ? aiDraft : aiDraft?.body ?? "";

  const payload: TicketDetailResponse = {
    id: ticket.id,
    viewerRole,
    source: "legacy",
    status: ticket.status,
    scheduledSendAt: ticket.scheduled_send_at ?? null,
    createdAt: null,
    retentionExempt: Boolean((ticket as { retention_exempt?: boolean }).retention_exempt),
    customer: {
      email: ticket.from_email,
      name: ticket.from_name,
    },
    subject: ticket.subject,
    subjectEnglish: null,
    intent: ticket.intent,
    confidence: ticket.confidence != null ? Number(ticket.confidence) : null,
    decision: null,
    requiresHuman: true,
    reasons: [],
    draft: {
      original: {
        subject: draftSubject,
        body: draftBody,
        language: null,
      },
      english: {
        subject: null,
        body: null,
      },
    },
    messages: [
      {
        direction: "inbound",
        fromEmail: ticket.from_email,
        toEmail: "",
        original: {
          subject: ticket.subject,
          body: ticket.body_text ?? "",
          language: null,
        },
        english: {
          subject: null,
          body: null,
        },
      },
    ],
    escalation: {
      department: ticket.escalation_department,
      reason: ticket.escalation_reason,
    },
    commerceContext: null,
    entityLinks: [],
    blockingAction: null,
    operationalTimeline: [],
  };

  return NextResponse.json(payload);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const body = await req.json().catch(() => ({})) as { draftBody?: unknown };
  if (typeof body.draftBody !== "string") {
    return NextResponse.json({ error: "Draft body is required." }, { status: 400 });
  }

  const draftBody = body.draftBody;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, status, latest_decision_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (conversation) {
    if (["sent", "escalated", "closed", "archived"].includes(conversation.status)) {
      return NextResponse.json({ error: "Conversation is final." }, { status: 400 });
    }
    if (!conversation.latest_decision_id) {
      return NextResponse.json({ error: "Conversation has no draft to save." }, { status: 400 });
    }

    const { error: decisionErr } = await supabase
      .from("support_decisions")
      .update({
        draft_body_original: draftBody,
        draft_body_english: null,
        translation_status: "pending",
        updated_at: now,
      })
      .eq("id", conversation.latest_decision_id)
      .eq("tenant_id", tenantId);

    if (decisionErr) return NextResponse.json({ error: decisionErr.message }, { status: 500 });

    await supabase
      .from("support_conversations")
      .update({ updated_at: now })
      .eq("id", conversation.id)
      .eq("tenant_id", tenantId);

    return NextResponse.json({ ok: true, savedAt: now });
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, status, ai_draft")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (["sent", "escalated", "archived"].includes(ticket.status)) return NextResponse.json({ error: "Ticket is final." }, { status: 400 });

  const { error: updateErr } = await supabase
    .from("tickets")
    .update({
      ai_draft: { ...(ticket.ai_draft as object ?? {}), body: draftBody },
      updated_at: now,
    })
    .eq("id", ticket.id)
    .eq("tenant_id", tenantId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, savedAt: now });
}
