import { getSupabaseClient } from "@/lib/supabase";

export type AgentConfig = {
  empathyEnabled:    boolean;
  allowDiscount:     boolean;
  maxDiscountAmount: number;
  signature:         string;
  languageDefault:   string;
  autosendEnabled:   boolean;
  autosendThreshold: number;
  autosendTime1:     string;
  autosendTime2:     string;
};

/**
 * Loads agent configuration for a specific tenant from the tenant_agent_config table.
 * Throws if tenantId is not found so callers get a clear 500 instead of silently
 * using wrong defaults.
 */
export async function loadAgentConfig(tenantId: string): Promise<AgentConfig> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("tenant_agent_config")
    .select(
      "empathy_enabled, allow_discount, max_discount_amount, signature, language_default, autosend_enabled, autosend_threshold, autosend_time_1, autosend_time_2"
    )
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) {
    throw new Error(
      `Agent config not found for tenant "${tenantId}": ${error?.message ?? "no row returned"}`
    );
  }

  return {
    empathyEnabled:    data.empathy_enabled    ?? true,
    allowDiscount:     data.allow_discount      ?? false,
    maxDiscountAmount: data.max_discount_amount ?? 0,
    signature:         data.signature           ?? "",
    languageDefault:   data.language_default    ?? "nl",
    autosendEnabled:   data.autosend_enabled    ?? false,
    autosendThreshold: data.autosend_threshold  ?? 0.85,
    autosendTime1:     data.autosend_time_1     ?? "08:00",
    autosendTime2:     data.autosend_time_2     ?? "16:00",
  };
}
