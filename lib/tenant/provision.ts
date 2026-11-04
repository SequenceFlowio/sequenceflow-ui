import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const TRIAL_DAYS = 14;

/**
 * The one way a new workspace comes into being: tenant on a 14-day trial, the
 * default agent configuration, and the user as its admin. Used by the login
 * callback for first-time users; anything else that needs a workspace should
 * call this too, so every tenant starts out the same.
 */
export async function provisionTenant(input: { userId: string; name: string }) {
  const admin = getSupabaseAdmin();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ name: input.name, plan: "trial", trial_ends_at: trialEndsAt })
    .select("id")
    .single();
  if (tenantError || !tenant) {
    throw new Error(`Failed to create tenant: ${tenantError?.message ?? "no id returned"}`);
  }

  const { error: configError } = await admin.from("tenant_agent_config").insert({ tenant_id: tenant.id });
  if (configError) console.error("[provisionTenant] agent config:", configError.message);

  const { error: memberError } = await admin
    .from("tenant_members")
    .insert({ tenant_id: tenant.id, user_id: input.userId, role: "admin" });
  if (memberError) {
    throw new Error(`Failed to create membership: ${memberError.message}`);
  }

  return { tenantId: tenant.id as string };
}

/** A readable default workspace name from the OAuth profile or the e-mail domain. */
export function defaultTenantName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  if (fullName) return fullName;
  const email = user.email ?? "";
  const domain = email.includes("@") ? email.split("@")[1] : "";
  return domain || "My Store";
}
