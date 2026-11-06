/**
 * Rekenregels voor het interne dashboard (alleen voor SequenceFlow zelf).
 * Prijzen per 1 miljoen tokens in dollars, zoals OpenAI ze publiceert.
 * Een model dat hier ontbreekt, rekenen we tegen het duurste bekende tarief,
 * zodat kosten nooit te laag uitvallen.
 */

export const USD_TO_EUR = 0.92;

type ModelPrice = { input: number; cached: number; output: number; estimate?: boolean };

export const MODEL_PRICES_USD: Record<string, ModelPrice> = {
  "gpt-4.1-mini": { input: 0.4, cached: 0.1, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, cached: 0.025, output: 0.4 },
  "gpt-4.1": { input: 2, cached: 0.5, output: 8 },
  "text-embedding-3-small": { input: 0.02, cached: 0.02, output: 0 },
  // Nog niet nagekeken bij OpenAI; ruim geschat.
  "gpt-5.4-mini": { input: 0.75, cached: 0.075, output: 4.5, estimate: true },
};

const FALLBACK: ModelPrice = { input: 2, cached: 0.5, output: 8, estimate: true };

export function modelPrice(model: string | null | undefined): ModelPrice {
  if (!model) return FALLBACK;
  if (MODEL_PRICES_USD[model]) return MODEL_PRICES_USD[model];
  const base = Object.keys(MODEL_PRICES_USD).find((name) => model.startsWith(name));
  return base ? MODEL_PRICES_USD[base] : FALLBACK;
}

export type UsageRow = {
  model: string | null;
  prompt_tokens: number | null;
  cached_input_tokens: number | null;
  completion_tokens: number | null;
};

/** Kosten van één AI-aanroep in euro. */
export function usageCostEur(row: UsageRow) {
  const price = modelPrice(row.model);
  const prompt = Math.max(0, row.prompt_tokens ?? 0);
  const cached = Math.min(prompt, Math.max(0, row.cached_input_tokens ?? 0));
  const output = Math.max(0, row.completion_tokens ?? 0);
  const usd = ((prompt - cached) * price.input + cached * price.cached + output * price.output) / 1_000_000;
  return usd * USD_TO_EUR;
}

/** Stripe per factuur: Europese kaart 1,5% + €0,25, Billing 0,7%, Tax 0,5%. */
export function stripeFeeEur(invoiceEur: number) {
  if (invoiceEur <= 0) return 0;
  return invoiceEur * (0.015 + 0.007 + 0.005) + 0.25;
}

/** Vaste kosten per maand (schatting op lijstprijzen; vervangen door de echte rekeningen). */
export const FIXED_MONTHLY_EUR: Array<{ name: string; eur: number }> = [
  { name: "Vercel Pro", eur: 19 },
  { name: "Supabase Pro", eur: 24 },
  { name: "Resend", eur: 0 },
  { name: "Domein en e-mail", eur: 10 },
];

export function sumBy<T>(items: T[], key: (item: T) => string, value: (item: T) => number) {
  const out = new Map<string, number>();
  for (const item of items) out.set(key(item), (out.get(key(item)) ?? 0) + value(item));
  return out;
}

export function marginPct(revenue: number, cost: number) {
  return revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : null;
}
