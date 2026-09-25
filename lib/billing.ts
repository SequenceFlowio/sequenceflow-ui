import { getShopifyBilling } from "@/lib/shopify/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAgencyWhitelistedEmail } from "@/lib/billingWhitelist";
import {
  PLAN_LIMITS,
  countAnswerUnits,
  usageHardLimit,
  type Plan,
  type UsageDecision,
} from "@/lib/billingPlans";

export { ANALYTICS_PLANS, AUTO_SEND_PLANS, PAIN_POINT_PLANS, PLAN_LIMITS, usageHardLimit, type Plan } from "@/lib/billingPlans";

type TenantPlanAccess = {
  /** Shopify-winkels betalen via Shopify App Pricing, niet via Stripe. */
  billingSource?: "shopify";
  plan: Plan;
  trialEndsAt: string | null;
  billingPeriodStart: string;
};

async function resolveTenantPlanAccess(tenantId: string): Promise<TenantPlanAccess> {
  const supabase = getSupabaseAdmin();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("plan, trial_ends_at, billing_period_start")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // Een gekoppelde Shopify-winkel bepaalt het pakket via Shopify App Pricing.
  const shopifyBilling = await getShopifyBilling(tenantId);
  if (shopifyBilling) return { ...shopifyBilling, billingSource: "shopify" };

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
        trialEndsAt: null,
        billingPeriodStart: tenant.billing_period_start
          ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
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

  return {
    plan,
    trialEndsAt: tenant.trial_ends_at ?? null,
    billingPeriodStart: tenant.billing_period_start
      ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  };
}

export async function getTenantPlanAccess(tenantId: string): Promise<{
  plan: Plan;
  trialEndsAt: string | null;
  billingSource: "stripe" | "shopify";
}> {
  const { plan, trialEndsAt, billingSource } = await resolveTenantPlanAccess(tenantId);
  return { plan, trialEndsAt, billingSource: billingSource ?? "stripe" };
}

/** Shopify-winkels betalen via Shopify; Stripe-checkout en -portal zijn voor hen dicht. */
export const SHOPIFY_BILLING_MESSAGE = "Je abonnement loopt via Shopify. Wijzig of beëindig het in je Shopify-beheer onder Apps → SequenceFlow Support.";

const USAGE_PAGE = 1000;

/** Antwoordconcepten van een tenant sinds het begin van de factuurperiode. */
export async function countTenantAnswerUnits(tenantId: string, since: string) {
  const supabase = getSupabaseAdmin();
  const decisions: UsageDecision[] = [];
  for (let from = 0; ; from += USAGE_PAGE) {
    const { data, error } = await supabase
      .from("support_decisions")
      .select("source_message_id, conversation_id, decision, model")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .not("source_message_id", "is", null)
      .neq("decision", "ignore")
      .not("draft_body_original", "is", null)
      .neq("draft_body_original", "")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + USAGE_PAGE - 1);
    if (error) throw new Error(`AI answer usage could not be calculated: ${error.message}`);
    for (const row of data ?? []) {
      decisions.push({
        source_message_id: row.source_message_id ? String(row.source_message_id) : null,
        conversation_id: row.conversation_id ? String(row.conversation_id) : null,
        decision: row.decision,
        model: row.model,
        has_draft: true,
      });
    }
    if (!data || data.length < USAGE_PAGE) break;
  }
  if (!decisions.length) return 0;

  // Uitgesloten gesprekken: als 'geen klantvraag' beoordeeld of spam die
  // volgens het spambeleid is teruggeboekt.
  const { data: excluded, error: excludedError } = await supabase
    .from("support_conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .or("status.eq.ignored,and(status.eq.spam,spam_billing_exempt.eq.true)");
  if (excludedError) throw new Error(`AI answer usage could not be calculated: ${excludedError.message}`);

  return countAnswerUnits(decisions, new Set((excluded ?? []).map((row) => String(row.id))));
}

export async function getTenantPlan(tenantId: string): Promise<{
  plan: Plan;
  limit: number;
  used: number;
  trialEndsAt: string | null;
  billingSource: "stripe" | "shopify";
}> {
  const supabase = getSupabaseAdmin();
  const { plan, trialEndsAt, billingPeriodStart, billingSource } = await resolveTenantPlanAccess(tenantId);

  // Er telt elk antwoordconcept voor een echte klantvraag (zie
  // countAnswerUnits): per klantbericht, niet per gesprek, zodat een
  // vervolgvraag wél en opnieuw genereren níet opnieuw telt. Boven de limiet
  // wordt er geen concept geschreven, dus die tellen vanzelf niet.
  const [conversationCount, { count: legacyTicketCount, error: legacyTicketCountError }] = await Promise.all([
    countTenantAnswerUnits(tenantId, billingPeriodStart),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("ai_draft", "is", null)
      .neq("status", "ignored")
      .or("status.neq.spam,spam_billing_exempt.eq.false")
      .gte("created_at", billingPeriodStart),
  ]);
  if (legacyTicketCountError) {
    throw new Error(`AI answer usage could not be calculated: ${legacyTicketCountError.message}`);
  }

  const used = conversationCount + (legacyTicketCount ?? 0);
  const limit = PLAN_LIMITS[plan].aiAnswers;

  return {
    plan,
    limit,
    used,
    trialEndsAt,
    billingSource: billingSource ?? "stripe",
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
    allowed: used < usageHardLimit(limit),
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
  const { plan } = await getTenantPlanAccess(tenantId);

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
