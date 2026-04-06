import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type Plan = "trial" | "starter" | "pro" | "agency" | "custom" | "expired";

// Emails that always receive agency-level access regardless of DB plan
const AGENCY_WHITELIST = ["sequenceflownl@gmail.com"];

export const PLAN_LIMITS: Record<Plan, { emails: number; inboxes: number; members: number; docs: number }> = {
  trial:   { emails: 150,      inboxes: 1,        members: 1,        docs: 10       },
  starter: { emails: 250,      inboxes: 1,        members: 2,        docs: 25       },
  pro:     { emails: 750,      inboxes: 3,        members: 5,        docs: 100      },
  agency:  { emails: 2000,     inboxes: 10,       members: Infinity, docs: Infinity },
  custom:  { emails: Infinity, inboxes: Infinity, members: Infinity, docs: Infinity },
  expired: { emails: 0,        inboxes: 0,        members: 0,        docs: 0        },
};

// Advanced analytics (charts, insights): Pro and above + trial for demo
export const ANALYTICS_PLANS: Plan[] = ["pro", "agency", "custom", "trial"];

// Auto-send without human approval: Pro and above
export const AUTO_SEND_PLANS: Plan[] = ["pro", "agency", "custom"];

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

  // Check email whitelist — look up any admin member of this tenant
  const { data: members } = await supabase
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId);

  if (members && members.length > 0) {
    const userIds = members.map((m: { user_id: string }) => m.user_id);
    const { data: users } = await supabase.auth.admin.listUsers();
    const tenantUsers = users?.users?.filter(u => userIds.includes(u.id)) ?? [];
    const isWhitelisted = tenantUsers.some(u => AGENCY_WHITELIST.includes(u.email ?? ""));
    if (isWhitelisted) {
      return {
        plan: "agency" as Plan,
        limit: PLAN_LIMITS.agency.emails,
        used: 0,
        trialEndsAt: null,
      };
    }
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

export async function checkDocLimit(tenantId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const supabase = getSupabaseAdmin();
  const { plan } = await getTenantPlan(tenantId);

  const docLimit = PLAN_LIMITS[plan].docs;

  if (docLimit === Infinity) return { allowed: true, used: 0, limit: Infinity };

  const { count } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("client_id", tenantId)
    .neq("status", "error");

  const used = count ?? 0;
  return { allowed: used < docLimit, used, limit: docLimit };
}
