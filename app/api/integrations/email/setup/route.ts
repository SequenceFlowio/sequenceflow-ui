/**
 * GET /api/integrations/email/setup
 *
 * Returns the unique inbound forwarding address for this tenant and their
 * current sender config (from name / from email for outgoing replies).
 */

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_FROM_EMAIL } from "@/lib/resend";

const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.emailreply.sequenceflow.io";

export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: any) {
    const status = err.message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: err.message }, { status });
  }

  const inboundEmail = `t-${tenantId}@${INBOUND_DOMAIN}`;
  const supabase = getSupabaseAdmin();
  const [
    { count: legacyTicketCount },
    { count: conversationCount },
    { count: knowledgeDocCount },
    { data: config },
    { data: channel },
  ] = await Promise.all([
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", tenantId),
    supabase
      .from("tenant_agent_config")
      .select("sender_email, sender_name, signature")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_email_channels")
      .select("inbound_address, outbound_from_email, outbound_from_name")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  const emailsReceived = (legacyTicketCount ?? 0) + (conversationCount ?? 0);
  const hasSignature = Boolean(config?.signature?.trim());

  return NextResponse.json({
    inboundEmail: channel?.inbound_address ?? inboundEmail,
    emailsReceived,
    isForwardingActive: emailsReceived > 0,
    hasSignature,
    knowledgeDocCount: knowledgeDocCount ?? 0,
    senderEmail: channel?.outbound_from_email ?? config?.sender_email ?? DEFAULT_FROM_EMAIL,
    senderName:  channel?.outbound_from_name ?? config?.sender_name  ?? "Customer Support",
  });
}
