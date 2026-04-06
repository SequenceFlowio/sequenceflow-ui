import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveTenant(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  // 1) Look up existing membership
  const { data, error } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Tenant lookup failed for user ${userId}: ${error.message}`);
  }

  if (data?.tenant_id) {
    return data.tenant_id as string;
  }

  // 2) No membership found — bootstrap a new tenant with a 14-day trial
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: newTenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ name: `Tenant ${userId.slice(0, 8)}`, plan: "trial", trial_ends_at: trialEndsAt })
    .select("id")
    .single();

  if (tenantError || !newTenant) {
    throw new Error(`Failed to create tenant for user ${userId}: ${tenantError?.message}`);
  }

  const { error: memberError } = await supabase
    .from("tenant_members")
    .insert({ tenant_id: newTenant.id, user_id: userId, role: "admin" });

  if (memberError) {
    throw new Error(`Failed to create membership for user ${userId}: ${memberError?.message}`);
  }

  return newTenant.id as string;
}
