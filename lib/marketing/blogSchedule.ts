/**
 * Planning van de blog, zonder bestandssysteem zodat tests en de backoffice
 * het ook kunnen gebruiken.
 *
 * Een post met een publishDate in de toekomst is "gepland": hij staat al in
 * content/blog, maar de site toont hem pas vanaf die dag om 07:00 (Amsterdam).
 * De blogpagina's verversen elk uur (revalidate), dus zonder nieuwe deploy
 * staat een geplande post binnen een uur na 07:00 live, ook in de sitemap.
 */

export const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** Hoe laat een geplande post live gaat, in Nederlandse tijd. */
export const PUBLISH_HOUR = 7;

/** Minimaal aantal posts per week (maandag t/m zondag) dat we willen halen. */
export const POSTS_PER_WEEK_TARGET = 4;

const TIME_ZONE = "Europe/Amsterdam";

export function parseFrontMatter(source: string) {
  const match = source.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {} as Record<string, string>, body: source };
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");
  }
  return { data, body: match[2] };
}

/** "30 mrt 2026" → [2026, 2, 30], of null als de datum niet te lezen is. */
export function parseDutchDate(value: string): [number, number, number] | null {
  const [day, month, year] = value.toLowerCase().trim().split(/\s+/);
  const monthIndex = MONTHS.indexOf(month ?? "");
  const y = Number(year);
  const d = Number(day);
  if (monthIndex < 0 || !Number.isInteger(y) || !Number.isInteger(d) || d < 1 || d > 31) return null;
  return [y, monthIndex, d];
}

/** Verschil tussen Amsterdamse tijd en UTC op een moment, in minuten (60 of 120). */
function amsterdamOffsetMinutes(utcMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(utcMs))
    .reduce<Record<string, number>>((all, part) => (part.type === "literal" ? all : { ...all, [part.type]: Number(part.value) }), {});
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - utcMs) / 60_000);
}

/** Het moment (ms sinds 1970) waarop een post met deze publishDate live gaat. */
export function publishMoment(publishDate: string) {
  const parts = parseDutchDate(publishDate);
  if (!parts) return 0;
  const naive = Date.UTC(parts[0], parts[1], parts[2], PUBLISH_HOUR);
  return naive - amsterdamOffsetMinutes(naive) * 60_000;
}

/** Live op `now`? Een post zonder leesbare datum telt als live (oude posts). */
export function isLive(publishDate: string, now = Date.now()) {
  return publishMoment(publishDate) <= now;
}

/** Datum (UTC-middag) → "18 nov 2026". */
export function formatDutchDate(date: Date) {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Maandag van de week waarin het moment valt, als "2026-11-16". */
export function weekKey(moment: number) {
  const date = new Date(moment + amsterdamOffsetMinutes(moment) * 60_000);
  const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return new Date(monday).toISOString().slice(0, 10);
}

export type WeekCount = { week: string; count: number; enough: boolean };

/**
 * Aantal posts per week voor `weeks` weken vanaf de week van `now`, zodat de
 * backoffice laat zien waar we onder het weekdoel zakken.
 */
export function weeklyCadence(publishDates: string[], now = Date.now(), weeks = 8, target = POSTS_PER_WEEK_TARGET): WeekCount[] {
  const counts = new Map<string, number>();
  for (const value of publishDates) {
    const moment = publishMoment(value);
    if (moment) counts.set(weekKey(moment), (counts.get(weekKey(moment)) ?? 0) + 1);
  }
  const first = Date.parse(`${weekKey(now)}T12:00:00Z`);
  return Array.from({ length: weeks }, (_, index) => {
    const week = new Date(first + index * 7 * 86_400_000).toISOString().slice(0, 10);
    const count = counts.get(week) ?? 0;
    return { week, count, enough: count >= target };
  });
}
