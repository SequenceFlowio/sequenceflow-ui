import { loadAlertRules } from "@/lib/inventory/alerts";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { addNote, readProfile, SAFETY_BUFFER, type OnboardingAnswers, type OtisProfile } from "./otisProfile";

/**
 * Database-kant van de kennismaking met Otis en zijn geheugen (migratie 073).
 * Zonder de migratie geeft `loadOtisProfile` ready: false en slaat de pagina de
 * kennismaking over; de rest van de voorraadpagina werkt gewoon.
 */

const db = () => getSupabaseAdmin();

function missingColumn(error: { code?: string; message: string } | null) {
  return Boolean(error) && (error!.code === "42703" || error!.code === "PGRST204" || /otis_(profile|onboarded_at)/.test(error!.message));
}

export async function loadOtisProfile(tenantId: string): Promise<{ ready: boolean; onboardedAt: string | null; profile: OtisProfile }> {
  const { data, error } = await db().from("inventory_settings").select("otis_onboarded_at, otis_profile").eq("tenant_id", tenantId).maybeSingle();
  if (missingColumn(error)) return { ready: false, onboardedAt: null, profile: {} };
  if (error) throw new Error(error.message);
  return { ready: true, onboardedAt: (data?.otis_onboarded_at as string | null) ?? null, profile: readProfile(data?.otis_profile) };
}

/**
 * Slaat de antwoorden op: inkoopinstellingen, mails, de "bijna op"-melding en het profiel.
 * Van de drie soorten "bijna op" voor alle producten staat daarna alleen de gekozen aan;
 * meldingen voor één product of variant blijven zoals ze waren.
 */
export async function saveOnboarding(tenantId: string, answers: OnboardingAnswers) {
  const current = await loadOtisProfile(tenantId);
  if (!current.ready) return { error: "Kennismaken met Otis kan nog niet: migratie 073 is nog niet uitgevoerd." as const };
  // Eerst de standaardmeldingen klaarzetten, zodat die niet later ongevraagd verschijnen.
  await loadAlertRules(tenantId);

  const profile: OtisProfile = { ...current.profile, sells: answers.sells || undefined, seasonal: answers.seasonal, priority: answers.priority, lowStock: answers.lowStock };
  const now = new Date().toISOString();
  const { error } = await db().from("inventory_settings").upsert({
    tenant_id: tenantId,
    lead_time_days: answers.leadTimeDays,
    cover_weeks: answers.coverWeeks,
    safety_buffer: SAFETY_BUFFER[answers.priority],
    alert_email: answers.alertEmail,
    weekly_email: answers.weeklyEmail,
    otis_profile: profile,
    otis_onboarded_at: current.onboardedAt ?? now,
    updated_at: now,
  }, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message);

  const lowKinds = ["days_below", "stock_below", "percent_below"];
  const { data: rules, error: rulesError } = await db().from("inventory_alert_rules").select("id, kind").eq("tenant_id", tenantId).eq("scope", "all").in("kind", lowKinds);
  if (rulesError) throw new Error(rulesError.message);
  const chosen = (rules ?? []).find((rule) => rule.kind === answers.lowStock.kind);
  const others = (rules ?? []).filter((rule) => rule.kind !== answers.lowStock.kind).map((rule) => rule.id as string);
  if (others.length) {
    const { error: offError } = await db().from("inventory_alert_rules").update({ enabled: false, updated_at: now }).in("id", others);
    if (offError) throw new Error(offError.message);
  }
  const { error: ruleError } = chosen
    ? await db().from("inventory_alert_rules").update({ enabled: true, threshold: answers.lowStock.threshold, updated_at: now }).eq("id", chosen.id)
    : await db().from("inventory_alert_rules").insert({ tenant_id: tenantId, kind: answers.lowStock.kind, scope: "all", threshold: answers.lowStock.threshold, enabled: true });
  if (ruleError) throw new Error(ruleError.message);
  return { profile };
}

/** Later kennismaken: de vraag verdwijnt, de standaardinstellingen blijven. */
export async function skipOnboarding(tenantId: string) {
  const current = await loadOtisProfile(tenantId);
  if (!current.ready || current.onboardedAt) return;
  const { error } = await db().from("inventory_settings").upsert({ tenant_id: tenantId, otis_onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message);
}

/** Otis onthoudt iets uit een gesprek. */
export async function rememberAboutShop(tenantId: string, text: string) {
  const current = await loadOtisProfile(tenantId);
  if (!current.ready) return { error: "Onthouden kan nog niet in deze omgeving (migratie 073)." };
  const next = addNote(current.profile, text);
  if ("error" in next) return next;
  const { error } = await db().from("inventory_settings").upsert({ tenant_id: tenantId, otis_profile: next, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message);
  return { saved: true, notes: next.notes?.length ?? 0 };
}

/** Een notitie wissen (vanaf de pagina). */
export async function forgetNote(tenantId: string, index: number) {
  const current = await loadOtisProfile(tenantId);
  if (!current.ready) return;
  const notes = [...(current.profile.notes ?? [])];
  if (index < 0 || index >= notes.length) return;
  notes.splice(index, 1);
  const { error } = await db().from("inventory_settings").update({ otis_profile: { ...current.profile, notes }, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}
