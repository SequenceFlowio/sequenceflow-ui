import { unstable_cache } from "next/cache";

import { parseResendUsage, type ResendUsage } from "./resendUsageCore";

/**
 * Haalt verbruik en limieten op bij Resend (GET /usage). Daarvoor is een sleutel met
 * volledige toegang nodig: RESEND_USAGE_API_KEY als die is ingesteld, anders RESEND_API_KEY.
 * Een sleutel die alleen mag versturen, krijgt een weigering; het dashboard zegt dat dan.
 */

export type ResendUsageState =
  | { ok: true; usage: ResendUsage; fetchedAt: string }
  | { ok: false; reason: "no_key" | "forbidden" | "error"; message?: string };

async function fetchUsage(): Promise<ResendUsageState> {
  const key = process.env.RESEND_USAGE_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, reason: "no_key" };
  try {
    const response = await fetch("https://api.resend.com/usage", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    const body = await response.json().catch(() => null) as { message?: string; name?: string } | null;
    if (response.status === 401 || response.status === 403) return { ok: false, reason: "forbidden", message: body?.message };
    if (!response.ok) return { ok: false, reason: "error", message: body?.message ?? `HTTP ${response.status}` };
    const usage = parseResendUsage(body);
    if (!usage) return { ok: false, reason: "error", message: "Onverwacht antwoord van Resend." };
    return { ok: true, usage, fetchedAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, reason: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

/** Vijf minuten bewaard: de backoffice hoeft Resend niet bij elke klik te vragen. */
const cached = unstable_cache(fetchUsage, ["backoffice-resend-usage-v1"], { revalidate: 300 });

export function loadResendUsage(options: { fresh?: boolean } = {}) {
  return options.fresh ? fetchUsage() : cached();
}
