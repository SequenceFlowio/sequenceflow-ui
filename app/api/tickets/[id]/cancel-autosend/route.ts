import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * Cancel a queued auto-send. Works for both storage layers:
 *
 *   - Legacy `tickets`: pending_autosend → draft
 *   - AI-first `support_conversations`: pending_autosend → review
 *
 * The UI passes the same id for both (ticket detail page reuses
 * conversation_id as the "ticket id" key), so we probe conversations first
 * and fall back to tickets.
 */
export async function POST(
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

  // ── 1. AI-first conversations ─────────────────────────────────────────────
  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (conversation) {
    if (conversation.status !== "pending_autosend") {
      return NextResponse.json({ error: "Conversation is not queued for auto-send" }, { status: 400 });
    }
    const { error: updateErr } = await supabase
      .from("support_conversations")
      .update({ status: "review", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 2. Legacy tickets ─────────────────────────────────────────────────────
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, tenant_id, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status !== "pending_autosend") {
    return NextResponse.json({ error: "Ticket is not queued for auto-send" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("tickets")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
