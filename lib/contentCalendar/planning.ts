import { addDays, format, getISODay, parseISO } from "date-fns";
import { FORMATS, PILLARS, PROMO_RATIO } from "./brand.ts";
import type { Post } from "./types.ts";

/**
 * Pure planningslogica van de Content Calendar (zonder database of API's),
 * zodat hij los te testen is: welke dagen, welke pijler, wanneer publiceren.
 */

export interface PlanInput {
  startDate: string;
  weeks: number;
  weekdays: number[]; // ISO: 1 = maandag … 7 = zondag
  time: string;
}

export function buildSlots({ startDate, weeks, weekdays, time }: PlanInput) {
  const start = parseISO(startDate);
  const slots: Array<{ date: string; time: string }> = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    if (weekdays.includes(getISODay(day))) slots.push({ date: format(day, "yyyy-MM-dd"), time });
  }
  return slots;
}

/** Verdeelt pijlers op gewicht, nooit twee keer dezelfde achter elkaar, product hooguit 1 op 8. */
export function assignPillars(count: number, existing: Post[]) {
  const recent = existing.slice(-8).map((p) => p.pillar);
  const result: string[] = [];
  const usage = new Map<string, number>(PILLARS.map((p) => [p.id, 0]));
  for (const pillar of recent) usage.set(pillar, (usage.get(pillar) ?? 0) + 1);
  for (let i = 0; i < count; i++) {
    const history = [...recent, ...result];
    const sincePromo = history.length - 1 - history.lastIndexOf("product");
    const promoAllowed = history.lastIndexOf("product") === -1 ? history.length >= 4 : sincePromo >= 1 / PROMO_RATIO - 1;
    const candidates = PILLARS
      .filter((p) => p.id !== history[history.length - 1])
      .filter((p) => !p.promo || promoAllowed)
      .map((p) => ({ id: p.id, score: (usage.get(p.id) ?? 0) / p.weight }))
      .sort((a, b) => a.score - b.score);
    const pick = candidates[0].id;
    usage.set(pick, (usage.get(pick) ?? 0) + 1);
    result.push(pick);
  }
  return result;
}

/**
 * Kiest per post een format op gewicht: nooit twee keer hetzelfde achter elkaar,
 * en formats die actuele feiten nodig hebben alleen als die er zijn.
 */
export function assignFormats(count: number, existing: Array<Pick<Post, "format">>, factsAvailable: boolean) {
  const recent = existing.slice(-10).map((p) => p.format ?? "tips");
  const usage = new Map<string, number>(FORMATS.map((f) => [f.id, 0]));
  for (const format of recent) usage.set(format, (usage.get(format) ?? 0) + 1);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const last = [...recent, ...result].at(-1);
    const pick = FORMATS
      .filter((f) => f.id !== last && (!f.needsFacts || factsAvailable))
      .map((f) => ({ id: f.id, score: (usage.get(f.id) ?? 0) / f.weight }))
      .sort((a, b) => a.score - b.score)[0].id;
    usage.set(pick, (usage.get(pick) ?? 0) + 1);
    result.push(pick);
  }
  return result;
}

/** "2026-11-02 12:00" in Nederlandse tijd. */
export function amsterdamNow(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
}

/** Goedgekeurd, moment voorbij (Nederlandse tijd) en nog niet te vaak/te recent geprobeerd. */
export function isDue(
  post: Pick<Post, "status" | "date" | "time" | "publish">,
  now: string,
  { maxAttempts, retryAfterMs, nowMs = Date.now() }: { maxAttempts: number; retryAfterMs: number; nowMs?: number },
) {
  return post.status === "approved"
    && `${post.date} ${post.time}` <= now
    && (post.publish?.attempts ?? 0) < maxAttempts
    && nowMs - new Date(post.publish?.lastAttemptAt ?? 0).getTime() > retryAfterMs;
}
