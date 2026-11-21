import { FIXED_MONTHLY_EUR, modelPrice, usageCostEur } from "../internal/costs.ts";

/**
 * Kosten en echte winst voor het beheerdashboard. Rekent zonder database, zodat
 * het te testen is en de demo dezelfde code gebruikt.
 *
 * Bronnen:
 * - OpenAI: elke AI-aanroep staat in ai_usage_events (ook teruggestorte
 *   aanroepen: die kostten ons wel geld). Prijs per model in lib/internal/costs.
 * - Stripe: kosten per betaalde factuur (percentage + vast bedrag).
 * - Vaste kosten: hosting en database per maand (schatting).
 * - Advertenties: Meta-uitgaven per maand zodra het advertentieaccount gekoppeld is.
 */

export type UsageEvent = {
  tenantId: string;
  operation: string;
  model: string | null;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  createdAt: string;
};

export type RevenueMonth = { month: string; revenueCents: number; paidInvoices: number };

/** Wat een onderdeel van de app heet in het dashboard. */
export const OPERATION_LABELS: Record<string, string> = {
  decision: "Seffy: antwoordconcept",
  customer_gate: "Poortwachter: is dit een klantvraag?",
  embedding: "Kennisbank doorzoekbaar maken",
  translation_customer: "Vertaling klantmail",
  translation_subject: "Vertaling onderwerp",
  translation_draft: "Vertaling concept",
  lumen_chat: "Team-chat",
  inventory_briefing: "Otis: voorraadbriefing",
  inventory_assistant: "Otis: vragen in de chat",
  pain_points: "Pijnpunten",
  learning: "Leren van aanpassingen",
  mining: "Oude mails doorlezen",
  commerce_briefing: "Commerce-briefing",
};

export const operationLabel = (operation: string) => OPERATION_LABELS[operation] ?? operation;

/** Stripe per betaalde factuur: 1,5% kaart + 0,7% Billing + 0,5% Tax + €0,25. */
export function stripeFeeCents(revenueCents: number, paidInvoices: number) {
  if (revenueCents <= 0) return 0;
  return revenueCents * 0.027 + paidInvoices * 25;
}

export const fixedMonthlyCents = () => FIXED_MONTHLY_EUR.reduce((sum, item) => sum + item.eur * 100, 0);

/** Kosten van één aanroep in eurocent (niet afgerond: losse aanroepen kosten fracties van een cent). */
export function eventCostCents(event: UsageEvent) {
  return usageCostEur({ model: event.model, prompt_tokens: event.promptTokens, cached_input_tokens: event.cachedTokens, completion_tokens: event.completionTokens }) * 100;
}

type Bucket = { calls: number; cents: number; tokens: number };
const bucket = (): Bucket => ({ calls: 0, cents: 0, tokens: 0 });

/** Telt aanroepen op, ook als ze per pagina binnenkomen (geen grote lijst in het geheugen). */
export class UsageTotals {
  byMonth = new Map<string, Bucket>();
  byDay = new Map<string, Bucket>();
  byOperation30 = new Map<string, Bucket>();
  byModel30 = new Map<string, Bucket & { estimate: boolean }>();
  byTenant30 = new Map<string, Bucket>();
  total30 = bucket();
  rows = 0;
  readonly since30: string;

  constructor(since30: string) {
    this.since30 = since30;
  }

  add(event: UsageEvent) {
    this.rows++;
    const cents = eventCostCents(event);
    const tokens = event.promptTokens + event.completionTokens;
    const put = <K>(map: Map<K, Bucket>, key: K) => {
      const item = map.get(key) ?? bucket();
      item.calls++;
      item.cents += cents;
      item.tokens += tokens;
      map.set(key, item);
    };
    put(this.byMonth, event.createdAt.slice(0, 7));
    if (event.createdAt < this.since30) return;
    put(this.byDay, event.createdAt.slice(0, 10));
    put(this.byOperation30, event.operation);
    put(this.byTenant30, event.tenantId);
    const model = event.model ?? "onbekend";
    const modelItem = this.byModel30.get(model) ?? { ...bucket(), estimate: Boolean(modelPrice(event.model).estimate) };
    modelItem.calls++;
    modelItem.cents += cents;
    modelItem.tokens += tokens;
    this.byModel30.set(model, modelItem);
    this.total30.calls++;
    this.total30.cents += cents;
    this.total30.tokens += tokens;
  }
}

export type CostMonth = {
  month: string;
  revenueCents: number;
  openAiCents: number;
  stripeCents: number;
  fixedCents: number;
  /** Null: Meta niet gekoppeld, dus onbekend (niet nul). */
  adsCents: number | null;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
};

export type CostReport = {
  now: string;
  months: CostMonth[];
  last30: { openAiCents: number; calls: number; tokens: number; perCallCents: number; drafts: number; perDraftCents: number | null };
  daily: Array<{ day: string; cents: number; calls: number }>;
  operations: Array<{ operation: string; label: string; calls: number; cents: number; perCallCents: number; sharePct: number }>;
  models: Array<{ model: string; calls: number; tokens: number; cents: number; estimate: boolean }>;
  tenants: Array<{ tenantId: string; name: string; calls: number; cents: number; mrrCents: number; marginPct: number | null }>;
  adsConnected: boolean;
  rows: number;
  truncated: boolean;
};

const DAY = 86_400_000;

export function buildCostReport(input: {
  now: string;
  totals: UsageTotals;
  revenue: RevenueMonth[];
  /** Meta-uitgaven per maand ("2026-11" → cent), of null als Meta niet gekoppeld is. */
  adsByMonth: Record<string, number> | null;
  tenants: Array<{ id: string; name: string; mrrCents: number }>;
  truncated?: boolean;
}): CostReport {
  const { totals } = input;
  const fixed = fixedMonthlyCents();
  const months = input.revenue.map((point): CostMonth => {
    const openAiCents = totals.byMonth.get(point.month)?.cents ?? 0;
    const stripeCents = stripeFeeCents(point.revenueCents, point.paidInvoices);
    const adsCents = input.adsByMonth ? input.adsByMonth[point.month] ?? 0 : null;
    const costCents = openAiCents + stripeCents + fixed + (adsCents ?? 0);
    const profitCents = point.revenueCents - costCents;
    return {
      month: point.month, revenueCents: point.revenueCents, openAiCents, stripeCents, fixedCents: fixed, adsCents, costCents, profitCents,
      marginPct: point.revenueCents > 0 ? Math.round((profitCents / point.revenueCents) * 100) : null,
    };
  });

  const now = Date.parse(input.now);
  const daily = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(now - (29 - index) * DAY).toISOString().slice(0, 10);
    const item = totals.byDay.get(day);
    return { day, cents: item?.cents ?? 0, calls: item?.calls ?? 0 };
  });

  const total = totals.total30;
  const drafts = totals.byOperation30.get("decision")?.calls ?? 0;
  const operations = [...totals.byOperation30.entries()]
    .map(([operation, item]) => ({ operation, label: operationLabel(operation), calls: item.calls, cents: item.cents, perCallCents: item.calls ? item.cents / item.calls : 0, sharePct: total.cents > 0 ? Math.round((item.cents / total.cents) * 100) : 0 }))
    .sort((a, b) => b.cents - a.cents);
  const models = [...totals.byModel30.entries()]
    .map(([model, item]) => ({ model, calls: item.calls, tokens: item.tokens, cents: item.cents, estimate: item.estimate }))
    .sort((a, b) => b.cents - a.cents);

  const names = new Map(input.tenants.map((tenant) => [tenant.id, tenant]));
  const tenants = [...totals.byTenant30.entries()]
    .map(([tenantId, item]) => {
      const tenant = names.get(tenantId);
      const mrrCents = tenant?.mrrCents ?? 0;
      return { tenantId, name: tenant?.name || tenantId.slice(0, 8), calls: item.calls, cents: item.cents, mrrCents, marginPct: mrrCents > 0 ? Math.round(((mrrCents - item.cents) / mrrCents) * 100) : null };
    })
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 20);

  return {
    now: input.now,
    months,
    last30: { openAiCents: total.cents, calls: total.calls, tokens: total.tokens, perCallCents: total.calls ? total.cents / total.calls : 0, drafts, perDraftCents: drafts ? (totals.byOperation30.get("decision")!.cents / drafts) : null },
    daily, operations, models, tenants,
    adsConnected: input.adsByMonth !== null,
    rows: totals.rows,
    truncated: Boolean(input.truncated),
  };
}
