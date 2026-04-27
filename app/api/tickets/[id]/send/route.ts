import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { sendTenantEmail } from "@/lib/email/outbound/mailer";
import { buildTenantInboundAddress } from "@/lib/email/inbound/address";
import { buildOutboundMessageId } from "@/lib/email/outbound/messageId";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
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
    const body = await req.json() as { draftBody?: string };
    draftBody = body.draftBody?.trim() || "";
  } catch {
    draftBody = "";
  }
  if (!draftBody) {
    const aiDraft = ticket.ai_draft as { body?: string } | null;
    draftBody = aiDraft?.body ?? "";
  }
  if (!draftBody) return NextResponse.json({ error: "No draft body to send" }, { status: 400 });

  try {
    // Fetch sender config for this tenant
    const { data: config } = await supabase
      .from("tenant_agent_config")
      .select("sender_email, sender_name")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const subject = ticket.subject?.startsWith("Re:") ? ticket.subject : `Re: ${ticket.subject}`;

    // gmail_message_id stores the original email's Message-ID header (for In-Reply-To)
    // gmail_thread_id stores the References chain from the incoming email
    const inReplyTo  = ticket.gmail_message_id || undefined;
    const references = ticket.gmail_thread_id
      ? `${ticket.gmail_thread_id} ${ticket.gmail_message_id ?? ""}`.trim()
      : ticket.gmail_message_id || undefined;

    await sendTenantEmail({
      tenantId,
      to:         ticket.from_email,
      fromEmail:  config?.sender_email ?? null,
      fromName:   config?.sender_name ?? null,
      subject,
      text:       draftBody,
      inReplyTo,
      references,
      replyTo:    buildTenantInboundAddress(tenantId),
      messageId:  buildOutboundMessageId(config?.sender_email ?? null),
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
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[tickets/send]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
