import type { Post } from "./types.ts";

/**
 * Twee kalenders in één app: Nederlands (het bestaande account) en Engels (Amerikaans publiek).
 * Elke taal heeft eigen koppelingen en een eigen tijdzone; datum en tijd van een post zijn
 * de lokale tijd van die taal. Posts zonder taal zijn Nederlands.
 */
export type Locale = "nl" | "en";
export const LOCALES: Locale[] = ["nl", "en"];

export const LOCALE_INFO: Record<Locale, { label: string; short: string; timeZone: string; zoneLabel: string }> = {
  nl: { label: "Nederlands", short: "NL", timeZone: "Europe/Amsterdam", zoneLabel: "Amsterdam" },
  en: { label: "English", short: "EN", timeZone: "America/New_York", zoneLabel: "New York (ET)" },
};

export const localeOf = (post: Pick<Post, "locale">): Locale => (post.locale === "en" ? "en" : "nl");
export const isLocale = (value: unknown): value is Locale => value === "nl" || value === "en";
export const parseLocale = (value: unknown): Locale => (value === "en" ? "en" : "nl");
export const byLocale = <T extends Pick<Post, "locale">>(posts: T[], locale: Locale) => posts.filter((p) => localeOf(p) === locale);

/** "2026-11-02 12:00" in de tijdzone van een taal. */
export function localNow(locale: Locale, now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: LOCALE_INFO[locale].timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
}

/** Alleen carrousels gaan mee naar Engels; reels en stories worden apart gemaakt. */
export const translatable = (post: Pick<Post, "kind" | "locale">) => localeOf(post) === "nl" && (!post.kind || post.kind === "carousel");

/** Id van de Engelse versie van een Nederlandse post. */
export const englishId = (id: string) => `${id}-en`;
/** Geen lange streepjes in onze teksten: "x—y" en "x – y" worden "x, y". */
export function cleanDashes(text: string) {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").replace(/^,\s*/, "");
}
