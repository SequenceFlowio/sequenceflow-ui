import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveTenant(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .single();

  if (error || !data?.tenant_id) {
    throw new Error(`Tenant not found for user ${userId}`);
  }

  return data.tenant_id as string;
}
