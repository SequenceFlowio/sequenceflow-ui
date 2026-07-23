import { NextResponse } from "next/server";

import { spamSenderKey } from "@/lib/ai/usage";
import { evaluateSpamRefund } from "@/lib/ai/spamProtection";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantId(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as {
      spam?: unknown;
      blockFuture?: unknown;
    };
    if (typeof body.spam !== "boolean") {
      return NextResponse.json({ error: "spam must be a boolean" }, { status: 400 });
    }

    const blockFuture = body.blockFuture === true;
    if (blockFuture && context.role !== "admin") {
      return NextResponse.json({ error: "Only an admin can block future mail from a sender." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const [{ data: conversation }, { data: ticket }] = await Promise.all([
      supabase
        .from("support_conversations")
        .select("customer_email")
        .eq("id", id)
        .eq("tenant_id", context.tenantId)
        .maybeSingle(),
      supabase
        .from("tickets")
        .select("from_email")
        .eq("id", id)
        .eq("tenant_id", context.tenantId)
        .maybeSingle(),
    ]);
    const senderEmail = conversation?.customer_email ?? ticket?.from_email ?? "";
    if (!senderEmail) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    const senderKey = spamSenderKey(context.tenantId, senderEmail);

    const refundPolicy = body.spam
      ? await evaluateSpamRefund({ tenantId: context.tenantId })
      : null;
    const rpc = body.spam ? "mark_ticket_spam" : "restore_ticket_from_spam";
    const args = body.spam
      ? {
          p_tenant_id: context.tenantId,
          p_ticket_id: id,
          p_actor_user_id: context.userId,
          p_sender_key: senderKey,
          p_block_future: blockFuture,
          p_refund_eligible: refundPolicy?.eligible ?? false,
          p_refund_reason: refundPolicy?.reason ?? "refund_policy_unavailable",
        }
      : {
          p_tenant_id: context.tenantId,
          p_ticket_id: id,
          p_actor_user_id: context.userId,
          p_sender_key: senderKey,
        };
    const { data, error } = await supabase.rpc(rpc, args);
    if (error) {
      const status = /not found/i.test(error.message)
        ? 404
        : /commerce action|handled tickets|not marked as spam/i.test(error.message)
          ? 409
          : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    let billingExempt = false;
    if (body.spam) {
      const table = data === "conversation" ? "support_conversations" : "tickets";
      const { data: updatedTicket } = await supabase
        .from(table)
        .select("spam_billing_exempt")
        .eq("id", id)
        .eq("tenant_id", context.tenantId)
        .maybeSingle();
      billingExempt = updatedTicket?.spam_billing_exempt === true;
    }

    return NextResponse.json({
      ok: true,
      source: data,
      spam: body.spam,
      blockedFuture: body.spam && blockFuture,
      refundStatus: body.spam
        ? billingExempt
          ? "refunded"
          : refundPolicy?.requiresReview
            ? "review_required"
            : "ineligible"
        : "recharged",
      billingExempt,
      providerMessageUntouched: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not authenticated";
    return NextResponse.json(
      { error: message },
      { status: message === "Not authenticated" ? 401 : 403 },
    );
  }
}
