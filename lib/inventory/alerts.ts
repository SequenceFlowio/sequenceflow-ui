import { configuredAppOrigin } from "@/lib/brand";
import { DEFAULT_ALERT_RULES, alertEmail, diffAlerts, evaluateAlerts, type AlertKind, type AlertRule, type AlertScope } from "@/lib/inventory/alertsCore";
import { shopDay } from "@/lib/inventory/core";
import { adminEmails, veraFrom } from "@/lib/inventory/email";
import type { InventoryReport } from "@/lib/inventory/reportCore";
import { sendEmail } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Vera's triggers against the database: the rules of a workspace (the default
 * ones are added once), the open alerts, and the daily mail with what is new.
 */

type RuleRow = { id: string; kind: AlertKind; scope: AlertScope; target_key: string | null; target_label: string | null; threshold: number | string | null; enabled: boolean };

const mapRule = (row: RuleRow): AlertRule => ({
  id: row.id, kind: row.kind, scope: row.scope, targetKey: row.target_key, targetLabel: row.target_label,
  threshold: row.threshold == null ? null : Number(row.threshold), enabled: row.enabled,
});

/** Missing tables (migration 061 not run yet) must not break the sync or the cron. */
export function alertsUnavailable(error: { message?: string; code?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "42703" || /inventory_alert|alert_email|alert_rules_seeded|schema cache/i.test(error.message ?? "")));
}

export async function loadAlertRules(tenantId: string) {
  const db = getSupabaseAdmin();
  const { data: settings, error: settingsError } = await db.from("inventory_settings").select("alert_rules_seeded").eq("tenant_id", tenantId).maybeSingle();
  if (settingsError) throw Object.assign(new Error(settingsError.message), { code: settingsError.code });
  if (!settings?.alert_rules_seeded) {
    const { error } = await db.from("inventory_alert_rules").insert(DEFAULT_ALERT_RULES.map((rule) => ({ tenant_id: tenantId, kind: rule.kind, scope: "all", threshold: rule.threshold })));
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    const { error: seededError } = await db.from("inventory_settings").upsert({ tenant_id: tenantId, alert_rules_seeded: true, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
    if (seededError) throw Object.assign(new Error(seededError.message), { code: seededError.code });
  }
  const { data, error } = await db.from("inventory_alert_rules").select("id,kind,scope,target_key,target_label,threshold,enabled")
    .eq("tenant_id", tenantId).order("created_at").order("id");
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return (data as RuleRow[]).map(mapRule);
}

async function tenantLanguage(tenantId: string) {
  const { data } = await getSupabaseAdmin().from("tenant_agent_config").select("language_default").eq("tenant_id", tenantId).maybeSingle();
  return data?.language_default === "en" ? "en" as const : "nl" as const;
}

/** Opens alerts that became true and closes the ones that are no longer; returns how many are new. */
export async function refreshInventoryAlerts(tenantId: string, report: InventoryReport) {
  const db = getSupabaseAdmin();
  const [rules, language] = await Promise.all([loadAlertRules(tenantId), tenantLanguage(tenantId)]);
  const hits = evaluateAlerts(report, rules, language);
  const { data: open, error } = await db.from("inventory_alerts").select("id,fingerprint").eq("tenant_id", tenantId).is("resolved_at", null);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  const { add, resolve } = diffAlerts(open ?? [], hits);
  if (resolve.length) {
    const { error: resolveError } = await db.from("inventory_alerts").update({ resolved_at: new Date().toISOString() }).in("id", resolve);
    if (resolveError) throw new Error(resolveError.message);
  }
  if (add.length) {
    const { error: addError } = await db.from("inventory_alerts").insert(add.map((alert) => ({
      tenant_id: tenantId, rule_id: alert.ruleId, kind: alert.kind, fingerprint: alert.fingerprint, variant_key: alert.variantKey,
      title: alert.title, body: alert.body, impact: alert.impact,
    })));
    // Two runs at once may both add the same alert; the unique index keeps one.
    if (addError && addError.code !== "23505") throw new Error(addError.message);
  }
  return { added: add.length, resolved: resolve.length, open: hits.length };
}

/** At most one mail a day, with the open alerts nobody was mailed about yet. */
export async function sendInventoryAlertEmail(tenantId: string, now = new Date()) {
  const db = getSupabaseAdmin();
  const { data: settings, error } = await db.from("inventory_settings").select("alert_email,last_alert_email_at").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!settings?.alert_email) return { recipients: 0, skipped: "off" };
  if (settings.last_alert_email_at && shopDay(settings.last_alert_email_at as string) === shopDay(now)) return { recipients: 0, skipped: "today" };
  const { data: alerts, error: alertsError } = await db.from("inventory_alerts").select("id,title,body,impact")
    .eq("tenant_id", tenantId).is("resolved_at", null).is("emailed_at", null).order("impact", { ascending: false }).limit(12);
  if (alertsError) throw new Error(alertsError.message);
  if (!alerts?.length) return { recipients: 0, skipped: "nothing_new" };
  const [{ data: connection }, language, recipients] = await Promise.all([
    db.from("commerce_connections").select("display_name").eq("tenant_id", tenantId).eq("status", "active").order("created_at").limit(1).maybeSingle(),
    tenantLanguage(tenantId),
    adminEmails(tenantId),
  ]);
  const message = alertEmail({ alerts, language, appUrl: configuredAppOrigin(), shopName: connection?.display_name ?? null });
  // One failing address must not stop the others, nor make everyone get the same mail again tomorrow.
  let delivered = 0;
  for (const to of recipients) {
    try {
      await sendEmail({ to, from: veraFrom(), subject: message.subject, text: message.text });
      delivered += 1;
    } catch (error) {
      console.error("[inventory/alerts/mail]", tenantId, to, error instanceof Error ? error.message : error);
    }
  }
  if (!delivered) return { recipients: 0, alerts: alerts.length, skipped: "send_failed" };
  const sentAt = now.toISOString();
  await db.from("inventory_alerts").update({ emailed_at: sentAt }).in("id", alerts.map((alert) => alert.id));
  await db.from("inventory_settings").update({ last_alert_email_at: sentAt }).eq("tenant_id", tenantId);
  return { recipients: delivered, alerts: alerts.length };
}
