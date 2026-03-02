import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the tenant_id for a given Supabase Auth user by querying tenant_members.
 *
 * v2 assumption: each user belongs to exactly one tenant.
 * Returns the first matching tenant_id (ordered by created_at ascending).
 *
 * @throws if no membership row exists for the user.
 */
export async function resolveTenant(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data?.tenant_id) {
    throw new Error(`Tenant not found for user ${userId}`);
  }

  return data.tenant_id as string;
}
