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

  // Derive the unique inbound address from the tenant ID
  const inboundEmail = `t-${tenantId}@${INBOUND_DOMAIN}`;

  // Check if any emails have ever been received (first-email indicator)
  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  // Fetch sender config from agent config
  const { data: config } = await supabase
    .from("tenant_agent_config")
    .select("sender_email, sender_name")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return NextResponse.json({
    inboundEmail,
    emailsReceived: count ?? 0,
    senderEmail: config?.sender_email ?? DEFAULT_FROM_EMAIL,
    senderName:  config?.sender_name  ?? "Customer Support",
  });
}
