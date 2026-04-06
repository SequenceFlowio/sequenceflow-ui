import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { getGmailToken, buildRawEmail, sendGmailMessage, deleteGmailDraft } from "@/lib/gmail";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "Not authenticated" ? 401 : 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, tenant_id, from_email, subject, gmail_thread_id, gmail_message_id, ai_draft, status, gmail_draft_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status === "sent") return NextResponse.json({ error: "Already sent" }, { status: 400 });

  // Accept edited draft body from client, fall back to stored draft
  let draftBody: string;
  try {
    const body = await req.json();
    draftBody = body.draftBody?.trim() || "";
  } catch {
    draftBody = "";
  }
  if (!draftBody) draftBody = (ticket.ai_draft as any)?.body ?? "";
  if (!draftBody) return NextResponse.json({ error: "No draft body to send" }, { status: 400 });

  try {
    const accessToken = await getGmailToken(tenantId);

    const subject = ticket.subject?.startsWith("Re:") ? ticket.subject : `Re: ${ticket.subject}`;

    const { raw, threadId } = buildRawEmail({
      to:        ticket.from_email,
      subject,
      body:      draftBody,
      inReplyTo: ticket.gmail_message_id || undefined,
      references: ticket.gmail_message_id || undefined,
      threadId:  ticket.gmail_thread_id  || undefined,
    });

    await sendGmailMessage(accessToken, raw, threadId);

    // Delete the Gmail draft now that it's been sent
    if ((ticket as any).gmail_draft_id) {
      await deleteGmailDraft(accessToken, (ticket as any).gmail_draft_id);
    }

    await supabase
      .from("tickets")
      .update({
        status:     "sent",
        ai_draft:   { ...(ticket.ai_draft as object ?? {}), body: draftBody },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[tickets/send]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
