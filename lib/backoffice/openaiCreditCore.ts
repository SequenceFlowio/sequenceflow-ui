/**
 * Rekenwerk voor het OpenAI-tegoed. OpenAI heeft geen API voor het resterende tegoed;
 * een beheerder neemt de stand over van platform.openai.com, en wij trekken daar de
 * kosten sinds dat moment van af. Zonder imports met een alias, zodat het los te testen is.
 */

export const OPENAI_BILLING_URL = "https://platform.openai.com/settings/organization/billing/overview";
export const DEFAULT_WARN_USD = 20;
export const WARN_DAYS = 7;

export type CreditEstimate = {
  balanceUsd: number;
  notedAt: string;
  spentSinceUsd: number;
  remainingUsd: number;
  /** Gemiddeld per dag over de laatste 7 dagen; null zonder kosten. */
  perDayUsd: number | null;
  daysLeft: number | null;
  /** "costs_api": OpenAI's eigen kostenoverzicht (admin-sleutel); "estimate": onze eigen telling van de aanroepen. */
  basis: "costs_api" | "estimate";
  level: "ok" | "low" | "empty";
};

export function estimateCredit(input: { balanceUsd: number; notedAt: string; spentSinceUsd: number; last7DaysUsd: number; basis: CreditEstimate["basis"]; warnUsd?: number }): CreditEstimate {
  const remainingUsd = Math.round((input.balanceUsd - input.spentSinceUsd) * 100) / 100;
  const perDayUsd = input.last7DaysUsd > 0 ? Math.round((input.last7DaysUsd / 7) * 100) / 100 : null;
  const daysLeft = perDayUsd ? Math.max(0, Math.floor(Math.max(0, remainingUsd) / perDayUsd)) : null;
  const warn = input.warnUsd ?? DEFAULT_WARN_USD;
  const level = remainingUsd <= 0 ? "empty" : remainingUsd <= warn || (daysLeft !== null && daysLeft < WARN_DAYS) ? "low" : "ok";
  return { balanceUsd: input.balanceUsd, notedAt: input.notedAt, spentSinceUsd: Math.round(input.spentSinceUsd * 100) / 100, remainingUsd, perDayUsd, daysLeft, basis: input.basis, level };
}

/** Totaal in dollars uit een antwoord van GET /v1/organization/costs. */
export function sumCostsResponse(body: unknown) {
  let total = 0;
  const buckets = (body as { data?: Array<{ results?: Array<{ amount?: { value?: number; currency?: string } }> }> })?.data ?? [];
  for (const bucket of buckets) for (const result of bucket.results ?? []) {
    if (result.amount?.currency && result.amount.currency.toLowerCase() !== "usd") continue;
    total += Number(result.amount?.value ?? 0);
  }
  return total;
}

/** "$12,40" */
export function usd(value: number) {
  return `$${value.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
