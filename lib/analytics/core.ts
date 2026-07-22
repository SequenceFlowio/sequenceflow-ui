export const ANALYTICS_DAY_OPTIONS = [7, 30, 90] as const;

export type AnalyticsDays = (typeof ANALYTICS_DAY_OPTIONS)[number];
export type HandlingBucket = "resolved" | "review" | "escalated" | "ignored" | "other";

export function parseAnalyticsDays(value: string | null | undefined): AnalyticsDays {
  const parsed = Number(value);
  return ANALYTICS_DAY_OPTIONS.includes(parsed as AnalyticsDays) ? parsed as AnalyticsDays : 30;
}

export function analyticsWindow(days: AnalyticsDays, now = new Date()) {
  const end = new Date(now);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { days, start, end, since: start.toISOString(), generatedAt: end.toISOString() };
}

export function classifyHandlingStatus(status: string | null | undefined): HandlingBucket {
  if (["sent", "approved", "closed"].includes(status ?? "")) return "resolved";
  if (["review", "open", "draft", "pending_autosend"].includes(status ?? "")) return "review";
  if (status === "escalated") return "escalated";
  if (status === "ignored" || status === "archived") return "ignored";
  return "other";
}

export function clampRate(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.max(0, Math.min(1, numerator / denominator));
}

export function utcDateKey(value: string | Date) {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

export function analyticsDateKeys(days: AnalyticsDays, now = new Date()) {
  const keys: string[] = [];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(utcDateKey(new Date(end.getTime() - offset * 24 * 60 * 60 * 1000)));
  }
  return keys;
}
