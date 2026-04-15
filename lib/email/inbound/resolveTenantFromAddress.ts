import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function extractEmail(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

export async function resolveTenantFromAddress(recipient: string): Promise<string> {
  const normalizedRecipient = extractEmail(recipient);
  const supabase = getSupabaseAdmin();

  const { data: exactMatch } = await supabase
    .from("tenant_email_channels")
    .select("tenant_id")
    .eq("inbound_address", normalizedRecipient)
    .maybeSingle();

  if (exactMatch?.tenant_id) {
    return exactMatch.tenant_id;
  }

  const localPart = normalizedRecipient.split("@")[0] ?? "";
  const match = localPart.match(/^t-([0-9a-f-]{36})$/i);
  if (match?.[1]) {
    return match[1];
  }

  throw new Error(`Could not resolve tenant from recipient: ${normalizedRecipient}`);
}
