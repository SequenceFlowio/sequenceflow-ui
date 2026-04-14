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

  let reason: string, departmentEmail: string, departmentName: string;
  try {
    const body = await req.json();
    reason          = String(body.reason         ?? "").trim();
    departmentEmail = String(body.departmentEmail ?? "").trim();
    departmentName  = String(body.departmentName  ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!reason)          return NextResponse.json({ error: "reason is required" },          { status: 400 });
  if (!departmentEmail) return NextResponse.json({ error: "departmentEmail is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, tenant_id, from_email, from_name, subject, body_text, gmail_thread_id, gmail_message_id, intent, confidence, ai_draft")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  try {
    // Fetch sender config
    const { data: config } = await supabase
      .from("tenant_agent_config")
      .select("sender_email, sender_name")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const from = buildFromAddress(config?.sender_name, config?.sender_email);

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
      (ticket.ai_draft as any)?.body || "(geen concept)",
    ].join("\n");

    await sendEmail({
      to:      departmentEmail,
      from,
      subject: `[Escalatie] ${ticket.subject}`,
      text:    emailBody,
    });

    const deptLabel = departmentName ? `${departmentName} <${departmentEmail}>` : departmentEmail;

    await supabase
      .from("tickets")
      .update({
        status:                "escalated",
        escalation_reason:     reason,
        escalation_department: deptLabel,
        updated_at:            new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[tickets/escalate]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
