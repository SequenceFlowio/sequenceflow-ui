import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { loadTenantRuntime } from "@/lib/tenants/loadTenantRuntime";
import { sendEscalationEmail } from "@/lib/email/outbound/sendEscalationEmail";
import { sendTenantEmail } from "@/lib/email/outbound/mailer";

export const runtime = "nodejs";

function formatFrom(name: string | null, email: string) {
  return name ? `${name} <${email}>` : email;
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
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  let reason: string, departmentEmail: string, departmentName: string;
  try {
    const body = await req.json();
    reason = String(body.reason ?? "").trim();
    departmentEmail = String(body.departmentEmail ?? "").trim();
    departmentName = String(body.departmentName ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });
  if (!departmentEmail) return NextResponse.json({ error: "departmentEmail is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, latest_decision_id, latest_inbound_message_id, customer_email, customer_name")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (conversation?.latest_decision_id && conversation.latest_inbound_message_id) {
    const runtime = await loadTenantRuntime(tenantId);
    const [{ data: decision }, { data: inboundMessage }] = await Promise.all([
      supabase
        .from("support_decisions")
        .select("*")
        .eq("id", conversation.latest_decision_id)
        .single(),
      supabase
        .from("support_messages")
        .select("*")
        .eq("id", conversation.latest_inbound_message_id)
        .single(),
    ]);

    const escalationBody = [
      "=== ESCALATION ===",
      `Reason: ${reason}`,
      `Department: ${departmentName || departmentEmail}`,
      "",
      "=== CUSTOMER ===",
      `From: ${conversation.customer_name ? `${conversation.customer_name} <${conversation.customer_email}>` : conversation.customer_email}`,
      `Subject: ${inboundMessage.subject_original}`,
      `Intent: ${decision.intent}`,
      `Confidence: ${Math.round(Number(decision.confidence) * 100)}%`,
      "",
      "=== ORIGINAL MESSAGE ===",
      inboundMessage.body_original || "(empty)",
      "",
      "=== AI DRAFT ===",
      decision.draft_body_original,
    ].join("\n");

    const sendResult = await sendEscalationEmail({
      tenantId,
      from: formatFrom(runtime.channel.outboundFromName, runtime.channel.outboundFromEmail),
      to: departmentEmail,
      subject: `[Escalation] ${inboundMessage.subject_original}`,
      body: escalationBody,
    });

    await Promise.all([
      supabase
        .from("support_decisions")
        .update({
          decision: "escalate",
          requires_human: true,
          review_status: "escalated",
          reasons: [...(Array.isArray(decision.reasons) ? decision.reasons : []), reason],
          actions: [
            ...(Array.isArray(decision.actions) ? decision.actions : []),
            { type: "ESCALATE_TO_DEPARTMENT", payload: { department: departmentName || departmentEmail } },
          ],
          updated_at: new Date().toISOString(),
        })
        .eq("id", decision.id),
      supabase
        .from("support_conversations")
        .update({
          status: "escalated",
          updated_at: new Date().toISOString(),
          latest_message_at: new Date().toISOString(),
        })
        .eq("id", conversation.id),
      supabase.from("support_events").insert({
        tenant_id: tenantId,
        request_id: sendResult.id,
        source: sendResult.provider,
        subject: inboundMessage.subject_original.slice(0, 120),
        intent: decision.intent,
        confidence: decision.confidence,
        latency_ms: 0,
        draft_text: decision.draft_body_original,
        outcome: "escalated",
      }),
    ]);

    return NextResponse.json({ ok: true });
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, tenant_id, from_email, from_name, subject, body_text, gmail_thread_id, gmail_message_id, intent, confidence, ai_draft")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  try {
    const { data: config } = await supabase
      .from("tenant_agent_config")
      .select("sender_email, sender_name")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const customerLabel = ticket.from_name
      ? `${ticket.from_name} <${ticket.from_email}>`
      : ticket.from_email;

    const confidenceLabel = ticket.confidence != null
      ? `${Math.round((ticket.confidence as number) * 100)}%`
      : "—";

    const emailBody = [
      "=== ESCALATIE ===",
      `Reden: ${reason}`,
      `Afdeling: ${departmentName || departmentEmail}`,
      "",
      "=== KLANTGEGEVENS ===",
      `Van: ${customerLabel}`,
      `Onderwerp: ${ticket.subject}`,
      ...(ticket.intent ? [`Intent: ${ticket.intent} (vertrouwen: ${confidenceLabel})`] : []),
      "",
      "=== ORIGINEEL BERICHT ===",
      ticket.body_text || "(geen berichtinhoud)",
      "",
      "=== AI CONCEPT (niet verzonden) ===",
      (
        typeof ticket.ai_draft === "object" &&
        ticket.ai_draft !== null &&
        "body" in ticket.ai_draft &&
        typeof ticket.ai_draft.body === "string"
          ? ticket.ai_draft.body
          : "(geen concept)"
      ),
    ].join("\n");

    await sendTenantEmail({
      tenantId,
      to: departmentEmail,
      fromEmail: config?.sender_email ?? null,
      fromName: config?.sender_name ?? null,
      subject: `[Escalatie] ${ticket.subject}`,
      text: emailBody,
    });

    const deptLabel = departmentName ? `${departmentName} <${departmentEmail}>` : departmentEmail;

    await supabase
      .from("tickets")
      .update({
        status: "escalated",
        escalation_reason: reason,
        escalation_department: deptLabel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, source: "legacy" });
  } catch (err: unknown) {
    console.error("[tickets/escalate]", err);
    const message = err instanceof Error ? err.message : "Escalation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
