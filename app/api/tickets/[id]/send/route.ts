import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { sendEmail, buildFromAddress } from "@/lib/resend";

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
    .select("id, tenant_id, from_email, subject, gmail_thread_id, gmail_message_id, ai_draft, status")
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
    // Fetch sender config for this tenant
    const { data: config } = await supabase
      .from("tenant_agent_config")
      .select("sender_email, sender_name")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const from = buildFromAddress(config?.sender_name, config?.sender_email);
    const subject = ticket.subject?.startsWith("Re:") ? ticket.subject : `Re: ${ticket.subject}`;

    // gmail_message_id stores the original email's Message-ID header (for In-Reply-To)
    // gmail_thread_id stores the References chain from the incoming email
    const inReplyTo  = ticket.gmail_message_id || undefined;
    const references = ticket.gmail_thread_id
      ? `${ticket.gmail_thread_id} ${ticket.gmail_message_id ?? ""}`.trim()
      : ticket.gmail_message_id || undefined;

    await sendEmail({
      to:         ticket.from_email,
      from,
      subject,
      text:       draftBody,
      inReplyTo,
      references,
    });

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
