import { getInboundEmailDomain } from "@/lib/email/inbound/address";
import { isGeneratedInboundAddress, readableAddressBase, readableAddressCandidates } from "@/lib/email/inbound/readableAddressCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Gives a workspace whose channel still has a "t-<uuid>@" address a readable
 * one. Never throws: on any problem the old address simply stays.
 */
export async function ensureReadableInboundAddress(tenantId: string, current: string | null | undefined) {
  if (!current || !isGeneratedInboundAddress(current)) return current ?? null;
  try {
    const db = getSupabaseAdmin();
    const [{ data: channel }, { data: install }, { data: tenant }] = await Promise.all([
      db.from("tenant_email_channels").select("id, outbound_from_email").eq("tenant_id", tenantId).eq("is_default", true).maybeSingle(),
      db.from("shopify_installations").select("shop_domain").eq("tenant_id", tenantId).maybeSingle(),
      db.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
    ]);
    if (!channel) return current;
    const base = readableAddressBase({ shopDomain: install?.shop_domain, supportEmail: channel.outbound_from_email, tenantName: tenant?.name });
    for (const candidate of readableAddressCandidates(base, getInboundEmailDomain())) {
      const { error } = await db.from("tenant_email_channels").update({ inbound_address: candidate, updated_at: new Date().toISOString() })
        .eq("id", channel.id).eq("tenant_id", tenantId).eq("inbound_address", current);
      if (!error) return candidate;
      // 23505 = taken by another workspace; try the next one.
      if (error.code !== "23505") break;
    }
  } catch (error) {
    console.error("[inbound-address] could not make it readable", error instanceof Error ? error.message : error);
  }
  return current;
}
