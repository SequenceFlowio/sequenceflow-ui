import { NextResponse } from "next/server";

import { translateForUi } from "@/lib/ai/translation/translateForUi";
import { blockingActionAllowsReply } from "@/lib/commerce/blocking";
import { AUTO_SEND_PLANS } from "@/lib/billing";
import { parseDraftSendRequest, type ParsedDraftSendRequest } from "@/lib/email/outbound/attachments";
import { saveScheduledAttachments } from "@/lib/email/outbound/scheduledAttachments";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseScheduledDate(value: string | null | undefined) {
  if (!value) throw new Error("Scheduled send time is required.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Scheduled send time is invalid.");
  if (date.getTime() <= Date.now()) throw new Error("Scheduled send time must be in the future.");
  return date;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let tenantId: string;
    try {
      ({ tenantId } = await getTenantId(req));
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", tenantId)
      .single();

    if (!AUTO_SEND_PLANS.includes(tenant?.plan)) {
      return NextResponse.json({ error: "Scheduled send requires Pro plan.", upgrade: true }, { status: 403 });
    }

    let parsedDraft: ParsedDraftSendRequest;
    try {
      parsedDraft = await parseDraftSendRequest(req);
    } catch (err: unknown) {
      return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
    }

    let scheduledSendAt: string;
    try {
      scheduledSendAt = parseScheduledDate(parsedDraft.scheduledSendAt).toISOString();
    } catch (err: unknown) {
      return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
    }

    const { data: conversation } = await supabase
      .from("support_conversations")
      .select("id, status, tenant_id, latest_decision_id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (conversation) {
      if (["sent", "closed", "ignored", "escalated", "archived"].includes(conversation.status)) {
        return NextResponse.json({ error: "Conversation is already final." }, { status: 400 });
      }

      if (!conversation.latest_decision_id) {
        return NextResponse.json({ error: "Conversation has no draft to schedule." }, { status: 400 });
      }

      const { data: decision } = await supabase
        .from("support_decisions")
        .select("id, draft_body_original, draft_body_english, draft_language, blocking_action_id")
        .eq("id", conversation.latest_decision_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!decision) {
        return NextResponse.json({ error: "Conversation draft not found." }, { status: 404 });
      }

      if (decision.blocking_action_id) {
        const { data: blockingAction } = await supabase.from("commerce_action_proposals")
          .select("status,last_error,confirmation_status,confirmation_error").eq("id", decision.blocking_action_id).eq("tenant_id", tenantId).maybeSingle();
        if (!blockingActionAllowsReply(blockingAction?.status, blockingAction?.confirmation_status)) {
          return NextResponse.json({ error: blockingAction?.confirmation_error || blockingAction?.last_error || "The cancellation succeeded, but its confirmation draft is not ready yet." }, { status: 409 });
        }
      }

      const finalDraftBody = (parsedDraft.draftBody || decision.draft_body_original || "").trim();
      if (!finalDraftBody) {
        return NextResponse.json({ error: "Draft body is empty." }, { status: 400 });
      }

      let finalDraftEnglish = decision.draft_body_english || "";
      if (decision.draft_language === "en") {
        finalDraftEnglish = finalDraftBody;
      } else if (finalDraftBody !== decision.draft_body_original || !finalDraftEnglish) {
        try {
          const translated = await translateForUi({
            tenantId,
            text: finalDraftBody,
            sourceLanguage: decision.draft_language,
            contextType: "draft",
          });
          finalDraftEnglish = translated.translatedText;
        } catch {
          finalDraftEnglish = decision.draft_body_english || finalDraftBody;
        }
      }

      await saveScheduledAttachments(supabase, {
        tenantId,
        conversationId: conversation.id,
      }, parsedDraft.attachments);

      const [{ error: decisionErr }, { error: conversationErr }] = await Promise.all([
        supabase
          .from("support_decisions")
          .update({
            draft_body_original: finalDraftBody,
            draft_body_english: finalDraftEnglish,
            review_status: "approved",
            updated_at: new Date().toISOString(),
          })
          .eq("id", decision.id)
          .eq("tenant_id", tenantId),
        supabase
          .from("support_conversations")
          .update({
            status: "pending_autosend",
            scheduled_send_at: scheduledSendAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id)
          .eq("tenant_id", tenantId),
      ]);

      if (decisionErr || conversationErr) {
        return NextResponse.json({ error: decisionErr?.message ?? conversationErr?.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, scheduledSendAt });
    }

    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, status, ai_draft")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (["sent", "escalated", "archived"].includes(ticket.status)) return NextResponse.json({ error: "Ticket is already final." }, { status: 400 });

    const aiDraft = ticket.ai_draft as { body?: string } | null;
    const finalDraftBody = (parsedDraft.draftBody || aiDraft?.body || "").trim();
    if (!finalDraftBody) return NextResponse.json({ error: "No draft body to schedule." }, { status: 400 });

    await saveScheduledAttachments(supabase, {
      tenantId,
      ticketId: ticket.id,
    }, parsedDraft.attachments);

    const { error: updateErr } = await supabase
      .from("tickets")
      .update({
        status: "pending_autosend",
        scheduled_send_at: scheduledSendAt,
        ai_draft: { ...(ticket.ai_draft as object ?? {}), body: finalDraftBody },
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
      .eq("tenant_id", tenantId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, scheduledSendAt });
  } catch (err: unknown) {
    console.error("[schedule-send]", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
