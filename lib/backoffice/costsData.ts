import { unstable_cache } from "next/cache";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { backofficeDemo } from "./auth";
import { buildCostReport, UsageTotals, type CostReport, type UsageEvent } from "./costs";
import { loadMetaSpendByMonth } from "./integrations";
import type { Dashboard } from "./metrics";

/**
 * Haalt de AI-aanroepen van de laatste zes maanden op (alleen lezen) en telt
 * ze per pagina op, zodat er nooit een enorme lijst in het geheugen staat.
 * Boekingen die alleen credits terugstorten of opnieuw afschrijven (met een
 * original_usage_event_id en nul tokens) zijn geen aanroep bij OpenAI.
 */

const PAGE = 1000;
const MAX_ROWS = 400_000;
const MONTHS = 6;
const DAY = 86_400_000;

type Row = { tenant_id: string; operation: string; model: string | null; prompt_tokens: number | null; cached_input_tokens: number | null; completion_tokens: number | null; created_at: string };

const toEvent = (row: Row): UsageEvent => ({
  tenantId: row.tenant_id, operation: row.operation, model: row.model,
  promptTokens: row.prompt_tokens ?? 0, cachedTokens: row.cached_input_tokens ?? 0, completionTokens: row.completion_tokens ?? 0,
  createdAt: row.created_at,
});

async function loadUsage(since: string, since30: string) {
  const totals = new UsageTotals(since30);
  const db = getSupabaseAdmin();
  let truncated = false;
  // Op id-volgorde bladeren is stabiel, ook als er tijdens het lezen nieuwe aanroepen bijkomen.
  for (let from = 0; ; from += PAGE) {
    if (from >= MAX_ROWS) { truncated = true; break; }
    const { data, error } = await db.from("ai_usage_events")
      .select("tenant_id, operation, model, prompt_tokens, cached_input_tokens, completion_tokens, created_at")
      .gte("created_at", since).is("original_usage_event_id", null).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Row[]) totals.add(toEvent(row));
    if (!data || data.length < PAGE) break;
  }
  return { totals, truncated };
}

const cachedUsage = unstable_cache(async (since: string, since30: string) => {
  const { totals, truncated } = await loadUsage(since, since30);
  // Maps overleven de cache niet: als lijsten opslaan en terugzetten.
  return { truncated, rows: totals.rows, total30: totals.total30, byMonth: [...totals.byMonth], byDay: [...totals.byDay], byOperation30: [...totals.byOperation30], byModel30: [...totals.byModel30], byTenant30: [...totals.byTenant30] };
}, ["backoffice-costs-v1"], { revalidate: 600 });

function demoUsage(now: number, since30: string) {
  const totals = new UsageTotals(since30);
  let state = 42;
  const random = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const mix: Array<[string, string, number, number, number]> = [
    ["decision", "gpt-4.1-mini", 0.62, 5200, 420],
    ["customer_gate", "gpt-4.1-mini", 0.14, 1400, 40],
    ["embedding", "text-embedding-3-small", 0.08, 900, 0],
    ["translation_customer", "gpt-4.1-nano", 0.06, 700, 300],
    ["inventory_assistant", "gpt-5.4-mini", 0.04, 6400, 380],
    ["inventory_briefing", "gpt-4.1-mini", 0.03, 8000, 600],
    ["learning", "gpt-4.1-mini", 0.03, 2400, 200],
  ];
  const tenants = ["demo-0", "demo-1", "demo-2", "demo-3", "demo-4", "demo-5", "demo-6", "demo-7"];
  for (let day = 180; day >= 0; day--) {
    const calls = Math.round(80 + (180 - day) * 2.2 + random() * 60);
    for (let call = 0; call < calls; call++) {
      let pick = random();
      const [operation, model, , prompt, completion] = mix.find((item) => (pick -= item[2]) <= 0) ?? mix[0];
      totals.add({
        tenantId: tenants[Math.floor(random() ** 1.6 * tenants.length)], operation, model,
        promptTokens: Math.round(prompt * (0.6 + random() * 0.8)), cachedTokens: Math.round(prompt * 0.3 * random()), completionTokens: Math.round(completion * (0.6 + random() * 0.8)),
        createdAt: new Date(now - day * DAY - random() * DAY).toISOString(),
      });
    }
  }
  return totals;
}

export async function loadCosts(data: Dashboard, options: { fresh?: boolean } = {}): Promise<{ report: CostReport | null; error: string | null }> {
  const now = Date.parse(data.now);
  const series = data.overview.series.slice(-MONTHS);
  const since = `${series[0].month}-01T00:00:00Z`;
  // Op het uur afgerond, zodat de cache een uur lang dezelfde sleutel heeft.
  const since30 = `${new Date(now - 30 * DAY).toISOString().slice(0, 13)}:00:00.000Z`;
  const tenants = data.customers.map((customer) => ({ id: customer.id, name: customer.name, mrrCents: customer.mrrCents }));
  const revenue = series.map((point) => ({ month: point.month, revenueCents: point.revenueCents, paidInvoices: point.paidInvoices }));

  if (backofficeDemo()) {
    const ads: Record<string, number> = {};
    for (const point of series.slice(-2)) ads[point.month] = 38_000;
    return { report: buildCostReport({ now: data.now, totals: demoUsage(now, since30), revenue, adsByMonth: ads, tenants: tenants.map((tenant, index) => ({ ...tenant, id: `demo-${index}` })) }), error: null };
  }

  try {
    const [usage, meta] = await Promise.all([
      options.fresh ? loadUsage(since, since30) : cachedUsage(since, since30).then((cached) => {
        const totals = new UsageTotals(since30);
        totals.rows = cached.rows;
        totals.total30 = cached.total30;
        totals.byMonth = new Map(cached.byMonth);
        totals.byDay = new Map(cached.byDay);
        totals.byOperation30 = new Map(cached.byOperation30);
        totals.byModel30 = new Map(cached.byModel30);
        totals.byTenant30 = new Map(cached.byTenant30);
        return { totals, truncated: cached.truncated };
      }),
      loadMetaSpendByMonth(series.map((point) => point.month)),
    ]);
    const report = buildCostReport({ now: data.now, totals: usage.totals, revenue, adsByMonth: meta.byMonth, tenants, truncated: usage.truncated });
    return { report, error: meta.error ? `Meta: ${meta.error}` : null };
  } catch (error) {
    console.error("[backoffice] kosten ophalen mislukt:", error instanceof Error ? error.message : error);
    return { report: null, error: error instanceof Error ? error.message : "onbekende fout" };
  }
}
