import { USD_TO_EUR, usageCostEur, type UsageRow } from "@/lib/internal/costs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { estimateCredit, sumCostsResponse, type CreditEstimate } from "./openaiCreditCore";

/**
 * Het OpenAI-tegoed (migratie 076). De laatste stand komt van een beheerder; de kosten
 * sindsdien uit OpenAI's eigen kostenoverzicht als OPENAI_ADMIN_KEY is ingesteld (een
 * admin-sleutel van platform.openai.com, alleen-lezen), anders uit onze eigen telling van
 * de AI-aanroepen. Die eigen telling mist aanroepen buiten Support One die dezelfde
 * OpenAI-organisatie gebruiken.
 */

const DAY = 24 * 60 * 60 * 1000;

export type CreditState =
  | { ready: false }
  | { ready: true; estimate: CreditEstimate | null; adminKey: boolean; error?: string };

async function costsApiUsd(fromIso: string, toIso: string) {
  const key = process.env.OPENAI_ADMIN_KEY?.trim();
  if (!key) return null;
  let total = 0;
  let page: string | null = null;
  for (let index = 0; index < 10; index += 1) {
    const params = new URLSearchParams({ start_time: String(Math.floor(Date.parse(fromIso) / 1000)), end_time: String(Math.ceil(Date.parse(toIso) / 1000)), bucket_width: "1d", limit: "180" });
    if (page) params.set("page", page);
    const response = await fetch(`https://api.openai.com/v1/organization/costs?${params}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const body = await response.json().catch(() => null) as { has_more?: boolean; next_page?: string | null; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? `OpenAI gaf HTTP ${response.status}`);
    total += sumCostsResponse(body);
    if (!body?.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return total;
}

async function ownEstimateUsd(fromIso: string) {
  const db = getSupabaseAdmin();
  let total = 0;
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await db.from("ai_usage_events").select("model, prompt_tokens, cached_input_tokens, completion_tokens")
      .gte("created_at", fromIso).is("original_usage_event_id", null).range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as UsageRow[]) total += usageCostEur(row) / USD_TO_EUR;
    if (!data || data.length < 1000) break;
  }
  return total;
}

async function spentUsd(fromIso: string, toIso: string): Promise<{ usd: number; basis: CreditEstimate["basis"] }> {
  try {
    const api = await costsApiUsd(fromIso, toIso);
    if (api !== null) return { usd: api, basis: "costs_api" };
  } catch (error) {
    console.error("[backoffice/openai] kostenoverzicht van OpenAI mislukt; eigen telling gebruikt", error instanceof Error ? error.message : error);
  }
  return { usd: await ownEstimateUsd(fromIso), basis: "estimate" };
}

export async function loadCredit(): Promise<CreditState> {
  const { data, error } = await getSupabaseAdmin().from("openai_credit_snapshots").select("id, balance_usd, noted_at").order("noted_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) return { ready: false };
    throw new Error(error.message);
  }
  const adminKey = Boolean(process.env.OPENAI_ADMIN_KEY?.trim());
  if (!data) return { ready: true, estimate: null, adminKey };
  const now = new Date().toISOString();
  try {
    const [since, week] = await Promise.all([spentUsd(data.noted_at as string, now), spentUsd(new Date(Date.now() - 7 * DAY).toISOString(), now)]);
    const warn = Number(process.env.OPENAI_CREDIT_WARN_USD);
    return {
      ready: true, adminKey,
      estimate: { ...estimateCredit({ balanceUsd: Number(data.balance_usd), notedAt: data.noted_at as string, spentSinceUsd: since.usd, last7DaysUsd: week.usd, basis: since.basis, warnUsd: Number.isFinite(warn) && warn > 0 ? warn : undefined }) },
    };
  } catch (cause) {
    return { ready: true, adminKey, estimate: null, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

/** De id van de laatste stand, zodat de waarschuwing per stand maar één keer gaat. */
export async function latestSnapshotId() {
  const { data } = await getSupabaseAdmin().from("openai_credit_snapshots").select("id").order("noted_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function saveCredit(balanceUsd: number, notedBy: string) {
  const { error } = await getSupabaseAdmin().from("openai_credit_snapshots").insert({ balance_usd: Math.round(balanceUsd * 100) / 100, noted_by: notedBy });
  if (error) throw new Error(error.message);
}
