import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function extractEmail(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

/**
 * The workspace for an inbound address, or null when no workspace uses it.
 * A database error throws instead, so the webhook can ask for a retry rather
 * than drop the mail as "unknown".
 */
export async function findTenantForAddress(recipient: string): Promise<string | null> {
  const normalizedRecipient = extractEmail(recipient);
  const supabase = getSupabaseAdmin();

  const { data: exactMatch, error } = await supabase
    .from("tenant_email_channels")
    .select("tenant_id")
    .eq("inbound_address", normalizedRecipient)
    .maybeSingle();
  if (error) throw new Error(`Inbound address lookup failed: ${error.message}`);

  if (exactMatch?.tenant_id) {
    return exactMatch.tenant_id;
  }

  // Generated t-<uuid> addresses keep working after a readable alias replaced them.
  const localPart = normalizedRecipient.split("@")[0] ?? "";
  const match = localPart.match(/^t-([0-9a-f-]{36})$/i);
  return match?.[1] ?? null;
}

export async function resolveTenantFromAddress(recipient: string): Promise<string> {
  const tenantId = await findTenantForAddress(recipient);
  if (tenantId) return tenantId;
  throw new Error(`Could not resolve tenant from recipient: ${extractEmail(recipient)}`);
}
