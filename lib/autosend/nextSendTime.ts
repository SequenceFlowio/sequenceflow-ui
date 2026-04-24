/**
 * Compute the next upcoming auto-send timestamp (in UTC) for a tenant, given
 * the two configured daily send times ("HH:MM", UTC) and the current moment.
 *
 * Returns null if neither time is configured.
 *
 * This is pure/UI-safe: no env access, no imports from server modules. It is
 * used by both the inbox list (to show "sends tomorrow 08:00" badges) and the
 * ticket detail page (to show a scheduled-send card).
 */

export type AutosendTimes = {
  time1: string | null;
  time2: string | null;
  enabled: boolean;
};

function parseHHMM(value: string | null | undefined): { h: number; m: number } | null {
  if (!value) return null;
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/**
 * Next upcoming send timestamp strictly after `now`. Iterates today and
 * tomorrow in UTC, picking the earliest configured slot that hasn't passed
 * yet (today) or the earliest slot tomorrow if both of today's are behind us.
 */
export function computeNextAutoSend(
  times: AutosendTimes | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!times || !times.enabled) return null;
  const slots = [parseHHMM(times.time1), parseHHMM(times.time2)].filter(
    (v): v is { h: number; m: number } => v !== null,
  );
  if (slots.length === 0) return null;

  const candidates: Date[] = [];
  for (const dayOffset of [0, 1]) {
    for (const s of slots) {
      const candidate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + dayOffset,
        s.h,
        s.m,
        0,
        0,
      ));
      if (candidate.getTime() > now.getTime()) candidates.push(candidate);
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0];
}

/**
 * Human-friendly scheduled-send label in the user's local timezone.
 *
 * Examples:
 *   "today 20:30"
 *   "tomorrow 08:00"
 *   "Mon 08:00"   (if somehow > 1 day out, which shouldn't happen)
 *
 * Language: "en" | "nl".
 */
export function formatAutoSendWhen(
  when: Date,
  language: "en" | "nl",
  now: Date = new Date(),
): string {
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  const timeStr = `${hh}:${mm}`;

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(when) - startOf(now)) / 86_400_000);

  if (language === "nl") {
    if (dayDiff <= 0) return `vandaag ${timeStr}`;
    if (dayDiff === 1) return `morgen ${timeStr}`;
    const dowNl = ["zo", "ma", "di", "wo", "do", "vr", "za"][when.getDay()];
    return `${dowNl} ${timeStr}`;
  }

  if (dayDiff <= 0) return `today ${timeStr}`;
  if (dayDiff === 1) return `tomorrow ${timeStr}`;
  const dowEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][when.getDay()];
  return `${dowEn} ${timeStr}`;
}

/**
 * Short countdown for a long-horizon wait (hours/minutes), e.g. "in 3h 24m".
 * For the final few minutes the existing mm:ss countdown takes over; this
 * helper is for the at-a-glance per-ticket badge.
 */
export function formatAutoSendCountdown(
  when: Date,
  language: "en" | "nl",
  now: Date = new Date(),
): string {
  const diffMs = when.getTime() - now.getTime();
  if (diffMs <= 0) return language === "nl" ? "nu" : "now";
  const totalMin = Math.max(1, Math.round(diffMs / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (language === "nl") {
    if (hours === 0) return `over ${minutes}m`;
    if (minutes === 0) return `over ${hours}u`;
    return `over ${hours}u ${minutes}m`;
  }
  if (hours === 0) return `in ${minutes}m`;
  if (minutes === 0) return `in ${hours}h`;
  return `in ${hours}h ${minutes}m`;
}
