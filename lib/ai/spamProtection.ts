import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { spamRefundPolicy } from "@/lib/ai/spamProtectionPolicy";

export { spamRefundPolicy } from "@/lib/ai/spamProtectionPolicy";

export async function evaluateSpamRefund(input: {
  tenantId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("billing_period_start")
    .eq("id", input.tenantId)
    .single();
  const since =
    tenant?.billing_period_start ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    { count: conversationCount },
    { count: legacyCount },
    { count: spamCount },
  ] = await Promise.all([
    supabase
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenantId)
      .gte("created_at", since),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenantId)
      .gte("created_at", since),
    supabase
      .from("spam_feedback_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenantId)
      .eq("source", "human")
      .eq("human_label", "spam")
      .gte("created_at", since),
  ]);

  return spamRefundPolicy({
    processedCases: (conversationCount ?? 0) + (legacyCount ?? 0),
    priorHumanSpamFlags: spamCount ?? 0,
  });
}
