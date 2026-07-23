import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAgencyWhitelistedEmail } from "@/lib/billingWhitelist";
import {
  PLAN_LIMITS,
  type Plan,
} from "@/lib/billingPlans";

export { ANALYTICS_PLANS, AUTO_SEND_PLANS, PAIN_POINT_PLANS, PLAN_LIMITS, type Plan } from "@/lib/billingPlans";

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
    const isWhitelisted = tenantUsers.some(u => isAgencyWhitelistedEmail(u.email));
    if (isWhitelisted) {
      return {
        plan: "agency" as Plan,
        limit: PLAN_LIMITS.agency.aiAnswers,
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

  const [
    { count: conversationCount, error: conversationCountError },
    { count: legacyTicketCount, error: legacyTicketCountError },
  ] = await Promise.all([
    supabase
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("latest_decision_id", "is", null)
      .neq("status", "ignored")
      .or("status.neq.spam,spam_billing_exempt.eq.false")
      .gte("created_at", billingStart),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("ai_draft", "is", null)
      .neq("status", "ignored")
      .or("status.neq.spam,spam_billing_exempt.eq.false")
      .gte("created_at", billingStart),
  ]);
  if (conversationCountError || legacyTicketCountError) {
    throw new Error(
      `AI answer usage could not be calculated: ${
        conversationCountError?.message ?? legacyTicketCountError?.message
      }`,
    );
  }

  const used = (conversationCount ?? 0) + (legacyTicketCount ?? 0);
  const limit = PLAN_LIMITS[plan].aiAnswers;

  return {
    plan,
    limit,
    used,
    trialEndsAt: tenant.trial_ends_at ?? null,
  };
}

export async function checkAiAnswerLimit(tenantId: string): Promise<{
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
