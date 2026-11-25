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

/** Een post bezet een moment (datum + tijd); reels en stories tellen niet mee voor de carrouselplanning. */
export const slotKey = (slot: { date: string; time: string }) => `${slot.date} ${slot.time}`;
export function takenSlots(posts: Array<Pick<Post, "date" | "time" | "kind">>) {
  return new Set(posts.filter((p) => !p.kind || p.kind === "carousel").map(slotKey));
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

/** Verdeelt pijlers op gewicht (maal prestatieboost), nooit twee keer dezelfde achter elkaar, product hooguit 1 op 8. */
export function assignPillars(count: number, existing: Post[], boost: Record<string, number> = {}) {
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
      .map((p) => ({ id: p.id, score: (usage.get(p.id) ?? 0) / (p.weight * (boost[p.id] ?? 1)) }))
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
export function assignFormats(count: number, existing: Array<Pick<Post, "format">>, factsAvailable: boolean, boost: Record<string, number> = {}) {
  const recent = existing.slice(-10).map((p) => p.format ?? "tips");
  const usage = new Map<string, number>(FORMATS.map((f) => [f.id, 0]));
  for (const format of recent) usage.set(format, (usage.get(format) ?? 0) + 1);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const last = [...recent, ...result].at(-1);
    const pick = FORMATS
      .filter((f) => f.id !== last && (!f.needsFacts || factsAvailable))
      .map((f) => ({ id: f.id, score: (usage.get(f.id) ?? 0) / (f.weight * (boost[f.id] ?? 1)) }))
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

/**
 * Hoe laat een post nog automatisch mag: daarna blijft hij staan (handmatig "Nu posten" kan altijd).
 * Zo gaat er geen stapel oude posts tegelijk live als een account later gekoppeld of
 * publiceren weer aangezet wordt.
 */
export const MAX_LATE_MS = 12 * 3_600_000;

/** Minuten tussen het moment van de post en nu, beide in dezelfde lokale tijd ("yyyy-MM-dd HH:mm"). */
export function lateMs(post: Pick<Post, "date" | "time">, now: string) {
  return Date.parse(`${now.replace(" ", "T")}:00Z`) - Date.parse(`${post.date}T${post.time}:00Z`);
}

/** Carrousel op "beoordelen" met een klare foto, waarvan het moment is aangebroken (en niet te lang geleden). */
export function shouldAutoApprove(post: Pick<Post, "status" | "date" | "time" | "kind" | "image" | "reel" | "video" | "parked">, now: string) {
  if (post.parked) return false;
  const carouselReady = (!post.kind || post.kind === "carousel") && post.image?.status === "ready";
  // gegenereerde reels gaan ook vanzelf, zodra de server de video heeft gemaakt
  const reelReady = post.kind === "reel" && post.reel?.status === "ready" && Boolean(post.video?.file);
  return post.status === "review" && (carouselReady || reelReady) && `${post.date} ${post.time}` <= now && lateMs(post, now) <= MAX_LATE_MS;
}

/** Een reel zonder video (de server maakt hem nog) kan nog niet gepost worden. */
export const hasMedia = (post: Pick<Post, "kind" | "video">) => (post.kind !== "reel" && post.kind !== "story") || Boolean(post.video?.file);

/** Goedgekeurd, moment voorbij (lokale tijd van de taal), niet te laat en nog niet te vaak/te recent geprobeerd. */

export function isDue(
  post: Pick<Post, "status" | "date" | "time" | "publish" | "parked">,
  now: string,
  { maxAttempts, retryAfterMs, nowMs = Date.now() }: { maxAttempts: number; retryAfterMs: number; nowMs?: number },
) {
  return post.status === "approved"
    && !post.parked
    && `${post.date} ${post.time}` <= now
    && lateMs(post, now) <= MAX_LATE_MS
    && (post.publish?.attempts ?? 0) < maxAttempts
    && nowMs - new Date(post.publish?.lastAttemptAt ?? 0).getTime() > retryAfterMs;
}

// ook algemene woorden die in veel koppen staan, zodat alleen echte onderwerpen tellen
const STOPWORDS = new Set(["mythe", "stelling", "levert", "altijd", "winst", "webshop", "shop", "ondernemers", "ondernemer", "zo", "een", "voor", "met", "zonder", "jouw", "deze", "die", "dat", "een", "het", "de", "en", "van", "je", "wat", "hoe", "waarom", "niet", "wel", "elke", "week", "meer", "minder", "echt",
  // Engels
  "the", "and", "your", "you", "for", "with", "this", "that", "what", "why", "how", "more", "less", "every", "from", "are", "not", "into", "than", "one", "get", "can", "its", "myth", "store", "stores", "business", "founder", "founders", "really"]);

function headlineWords(headline: string) {
  return new Set(headline.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

/**
 * Lijkt deze kop te veel op een bestaande? Exact dezelfde kop, of minstens 60% dezelfde
 * kernwoorden. Zo komt "5 cijfers die je elke week moet zien" er geen tweede keer in.
 */
export function isTooSimilar(headline: string, existing: string[]) {
  const words = headlineWords(headline);
  if (!words.size) return false;
  return existing.some((other) => {
    const otherWords = headlineWords(other);
    if (!otherWords.size) return false;
    const shared = [...words].filter((w) => otherWords.has(w)).length;
    return shared / Math.min(words.size, otherWords.size) >= 0.6 && shared >= Math.min(2, words.size);
  });
}

const STORY_MAX_ATTEMPTS = 4;

/** Komt deze reel (nog) als story? Net geplaatst, met video, nog geen story en niet te vaak mislukt. */
export function wantsReelStory(post: Post, now = Date.now()) {
  const at = post.publish?.instagram?.at;
  return post.kind === "reel" && post.status === "posted" && Boolean(post.video?.file) && Boolean(at) && !post.publish?.instagramStory
    && (post.publish?.storyAttempts ?? 0) < STORY_MAX_ATTEMPTS && now - new Date(at!).getTime() < 20 * 3_600_000;
}

