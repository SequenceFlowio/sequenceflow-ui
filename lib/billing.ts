import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type Plan = "trial" | "starter" | "growth" | "scale" | "expired";

export const PLAN_LIMITS: Record<Plan, { emails: number; inboxes: number; members: number; docs: number }> = {
  trial:   { emails: 750,  inboxes: 3,        members: 5,        docs: 50       },
  starter: { emails: 150,  inboxes: 1,        members: 2,        docs: 10       },
  growth:  { emails: 750,  inboxes: 3,        members: 5,        docs: 50       },
  scale:   { emails: 3000, inboxes: Infinity, members: Infinity, docs: Infinity },
  expired: { emails: 0,    inboxes: 0,        members: 0,        docs: 0        },
};

export const ANALYTICS_PLANS: Plan[] = ["growth", "scale", "trial"];

export async function getTenantPlan(tenantId: string): Promise<{
  plan: Plan;
  limit: number;
  used: number;
  trialEndsAt: string | null;
}> {
  const supabase = getSupabaseAdmin();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("plan, trial_ends_at, billing_period_start")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  let plan = (tenant.plan ?? "trial") as Plan;

  // Auto-expire trial if past trial_ends_at
  if (plan === "trial" && tenant.trial_ends_at) {
    const trialEnd = new Date(tenant.trial_ends_at);
    if (trialEnd < new Date()) {
      plan = "expired";
      // Update in DB async (don't await to avoid blocking)
      supabase
        .from("tenants")
        .update({ plan: "expired" })
        .eq("id", tenantId)
        .then(() => {});
    }
  }

  const billingStart = tenant.billing_period_start ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { count } = await supabase
    .from("support_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .neq("outcome", "error")
    .gte("created_at", billingStart);

  const used = count ?? 0;
  const limit = PLAN_LIMITS[plan].emails;

  return {
    plan,
    limit,
    used,
    trialEndsAt: tenant.trial_ends_at ?? null,
  };
}

export async function checkEmailLimit(tenantId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const { plan, used, limit } = await getTenantPlan(tenantId);

  if (plan === "expired") {
    return { allowed: false, used, limit: 0 };
  }

  return {
    allowed: used < limit,
    used,
    limit,
  };
}
