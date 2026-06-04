import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extractVisibleReplyText } from "@/lib/email/inbound/replyText";
import { deleteInboundAttachmentsForConversation, loadMessageAttachmentViews } from "@/lib/email/inbound/messageAttachments";
import type { TicketDetailResponse } from "@/types/aiInbox";

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
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (conversation) {
    await deleteInboundAttachmentsForConversation(supabase, id);
    await supabase.from("support_decisions").delete().eq("conversation_id", id);
    await supabase.from("support_messages").delete().eq("conversation_id", id);
    await supabase.from("support_conversations").delete().eq("id", id).eq("tenant_id", tenantId);
    return NextResponse.json({ ok: true });
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
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  const supabase = getSupabaseAdmin();

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, status, scheduled_send_at, customer_email, customer_name, subject_original, subject_english, latest_decision_id, created_at")
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

    const escalationAction = Array.isArray(decision?.actions)
      ? decision.actions.find(
          (action: unknown): action is { payload?: { department?: string } } =>
            typeof action === "object" && action !== null
        )
      : null;

    const payload: TicketDetailResponse = {
      id: conversation.id,
      source: "conversation",
      status: conversation.status,
      scheduledSendAt: conversation.scheduled_send_at ?? null,
      createdAt: conversation.created_at ?? null,
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
    };

    return NextResponse.json(payload);
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, subject, from_email, from_name, intent, confidence, body_text, ai_draft, status, scheduled_send_at, escalation_reason, escalation_department")
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
    source: "legacy",
    status: ticket.status,
    scheduledSendAt: ticket.scheduled_send_at ?? null,
    createdAt: null,
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
    if (conversation.status === "sent" || conversation.status === "escalated" || conversation.status === "closed") {
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
  if (ticket.status === "sent") return NextResponse.json({ error: "Ticket is final." }, { status: 400 });

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
