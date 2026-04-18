import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { TicketDetailResponse } from "@/types/aiInbox";

export const runtime = "nodejs";

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
    .select("id, status, customer_email, customer_name, subject_original, subject_english, latest_decision_id")
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
          body: message.body_original ?? "",
          language: message.language_original ?? null,
        },
        english: {
          subject: message.subject_english ?? null,
          body: message.body_english ?? null,
        },
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
    .select("id, subject, from_email, from_name, intent, confidence, body_text, ai_draft, status, escalation_reason, escalation_department")
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
