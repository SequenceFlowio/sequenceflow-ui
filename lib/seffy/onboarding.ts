import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Kennismaking met Seffy (migratie 075). Zonder die migratie is "ready" false
 * en toont de app de kennismaking niet: niets breekt.
 */

function missingColumn(error: { code?: string; message: string } | null) {
  return Boolean(error && (error.code === "42703" || error.code === "PGRST204" || /seffy_onboarded_at/.test(error.message)));
}

export async function loadSeffyOnboarding(tenantId: string): Promise<{ ready: boolean; onboardedAt: string | null }> {
  const { data, error } = await getSupabaseAdmin().from("tenant_agent_config").select("seffy_onboarded_at").eq("tenant_id", tenantId).maybeSingle();
  if (missingColumn(error)) return { ready: false, onboardedAt: null };
  if (error) throw new Error(error.message);
  return { ready: true, onboardedAt: (data?.seffy_onboarded_at as string | null) ?? null };
}

/** Afgerond of overgeslagen: daarna vraagt Seffy het niet meer. Opnieuw doen kan met reset. */
export async function setSeffyOnboarded(tenantId: string, done: boolean) {
  const current = await loadSeffyOnboarding(tenantId);
  if (!current.ready) return { ready: false };
  const { error } = await getSupabaseAdmin().from("tenant_agent_config").upsert({ tenant_id: tenantId, seffy_onboarded_at: done ? new Date().toISOString() : null }, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message);
  return { ready: true };
}
