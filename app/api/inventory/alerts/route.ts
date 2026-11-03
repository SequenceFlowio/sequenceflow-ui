import { NextResponse } from "next/server";

import { alertsUnavailable, loadAlertRules, refreshInventoryAlerts } from "@/lib/inventory/alerts";
import { ALERT_KINDS, ALERT_KIND_INFO, normalizeThreshold, type AlertKind, type AlertScope } from "@/lib/inventory/alertsCore";
import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { REPORT_VERSION } from "@/lib/inventory/reportCore";
import { loadCachedInventoryReport, rebuildInventoryReport } from "@/lib/inventory/sync";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const NOT_READY = { error: "Vera's meldingen staan nog niet aan: migratie 061 is nog niet gedraaid.", notReady: true };

/** After a rule changes: check it against the current report right away, without mailing. */
async function recheck(tenantId: string) {
  let report = await loadCachedInventoryReport(tenantId);
  if (!report || report.version !== REPORT_VERSION) report = await rebuildInventoryReport(tenantId);
  await refreshInventoryAlerts(tenantId, report);
}

async function state(tenantId: string) {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [rules, { data: open, error: openError }, { data: resolved, error: resolvedError }] = await Promise.all([
    loadAlertRules(tenantId),
    db.from("inventory_alerts").select("id,rule_id,kind,variant_key,title,body,impact,opened_at,emailed_at").eq("tenant_id", tenantId).is("resolved_at", null).order("impact", { ascending: false }).limit(100),
    db.from("inventory_alerts").select("id,rule_id,kind,variant_key,title,body,impact,opened_at,resolved_at").eq("tenant_id", tenantId).gte("resolved_at", since).order("resolved_at", { ascending: false }).limit(30),
  ]);
  if (openError || resolvedError) throw openError ?? resolvedError;
  return { rules, open: open ?? [], resolved: resolved ?? [] };
}

function failed(error: unknown) {
  if (alertsUnavailable(error as { message?: string; code?: string })) return NextResponse.json(NOT_READY, { status: 409 });
  return inventoryError(error, "alerts");
}

/** GET /api/inventory/alerts: Vera's rules, open alerts and those closed in the last 30 days. */
export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  try {
    return NextResponse.json(await state(access.context.tenantId));
  } catch (error) {
    return failed(error);
  }
}

/** POST: a new rule. Body: kind, scope ('all' | 'product' | 'variant'), targetKey, targetLabel, threshold. */
export async function POST(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const kind = body.kind as AlertKind;
  if (!ALERT_KINDS.includes(kind)) return NextResponse.json({ error: "Kies wanneer Vera iets moet melden." }, { status: 400 });
  const scope = (body.scope ?? "all") as AlertScope;
  if (!ALERT_KIND_INFO[kind].scopes.includes(scope)) return NextResponse.json({ error: "Deze melding kan niet voor één product of variant." }, { status: 400 });
  const targetKey = scope === "all" ? null : typeof body.targetKey === "string" && body.targetKey.length <= 400 ? body.targetKey : "";
  if (targetKey === "") return NextResponse.json({ error: scope === "product" ? "Kies een product." : "Kies een variant." }, { status: 400 });
  const threshold = normalizeThreshold(kind, body.threshold);
  if (threshold === undefined) return NextResponse.json({ error: "Die grens kan niet." }, { status: 400 });
  const targetLabel = scope === "all" ? null : String(body.targetLabel ?? "").slice(0, 300) || null;
  try {
    const { error } = await getSupabaseAdmin().from("inventory_alert_rules").insert({
      tenant_id: access.context.tenantId, kind, scope, target_key: targetKey, target_label: targetLabel, threshold, created_by: access.context.userId,
    });
    if (error) throw error;
    await recheck(access.context.tenantId);
    return NextResponse.json(await state(access.context.tenantId));
  } catch (error) {
    return failed(error);
  }
}

/** PATCH: turn a rule on or off, or change its threshold. Body: id, enabled?, threshold?. */
export async function PATCH(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof body.id !== "string") return NextResponse.json({ error: "Regel ontbreekt." }, { status: 400 });
  try {
    const db = getSupabaseAdmin();
    const { data: rule, error: ruleError } = await db.from("inventory_alert_rules").select("kind").eq("tenant_id", access.context.tenantId).eq("id", body.id).maybeSingle();
    if (ruleError) throw ruleError;
    if (!rule) return NextResponse.json({ error: "Deze regel bestaat niet meer." }, { status: 404 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Ongeldige waarde." }, { status: 400 });
      update.enabled = body.enabled;
    }
    if (body.threshold !== undefined) {
      const threshold = normalizeThreshold(rule.kind as AlertKind, body.threshold);
      if (threshold === undefined) return NextResponse.json({ error: "Die grens kan niet." }, { status: 400 });
      update.threshold = threshold;
    }
    const { error } = await db.from("inventory_alert_rules").update(update).eq("tenant_id", access.context.tenantId).eq("id", body.id);
    if (error) throw error;
    await recheck(access.context.tenantId);
    return NextResponse.json(await state(access.context.tenantId));
  } catch (error) {
    return failed(error);
  }
}

/** DELETE ?id=: remove a rule and its alerts. */
export async function DELETE(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Regel ontbreekt." }, { status: 400 });
  try {
    const { error } = await getSupabaseAdmin().from("inventory_alert_rules").delete().eq("tenant_id", access.context.tenantId).eq("id", id);
    if (error) throw error;
    return NextResponse.json(await state(access.context.tenantId));
  } catch (error) {
    return failed(error);
  }
}
