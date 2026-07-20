import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeSenderFilterEmail } from "@/lib/email/inbound/senderFilterIdentity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function isTenantSenderBlocked(
  tenantId: string,
  senderEmail: string,
  supabase: SupabaseClient = getSupabaseAdmin(),
) {
  const email = normalizeSenderFilterEmail(senderEmail);
  if (!email) return false;
  const { data, error } = await supabase.from("tenant_sender_filters").select("id")
    .eq("tenant_id", tenantId).eq("email", email).maybeSingle();
  if (error) throw new Error(`Could not check tenant sender filters: ${error.message}`);
  return Boolean(data);
}
