import { addDays, format, getISOWeek, getISOWeekYear, parseISO } from "date-fns";
import { COMPETITOR_GUARD } from "./brand.ts";
import { isTooSimilar } from "./planning.ts";
import { localeOf, type Locale } from "./locale.ts";
import type { Post, ReelTemplate } from "./types.ts";

/**
 * Pure planning voor de reel-generator (los te testen): welke momenten, welk type,
 * en of een concept uniek is en niet tegen onze eigen producten in adviseert.
 */

/** Twee reels per dag per taal, in de lokale tijd van die taal. */
export const REEL_TIMES: Record<Locale, string[]> = { nl: ["12:30", "20:00"], en: ["12:00", "19:00"] };

/** Startverhouding: tips om te bewaren en delen, unaware om nieuwe mensen te bereiken, aware om te verkopen. */
export const REEL_MIX: Record<ReelTemplate, number> = { tips: 0.5, unaware: 0.25, aware: 0.25 };

export function reelSlots(locale: Locale, from: string, days: number, existing: Array<Pick<Post, "date" | "time" | "kind" | "locale">>) {
  const taken = new Set(existing.filter((p) => p.kind === "reel" && (p.locale ?? "nl") === locale).map((p) => `${p.date} ${p.time}`));
  const slots: Array<{ date: string; time: string }> = [];
  for (let d = 0; d < days; d++) {
    const date = format(addDays(parseISO(from), d), "yyyy-MM-dd");
    for (const time of REEL_TIMES[locale]) if (!taken.has(`${date} ${time}`)) slots.push({ date, time });
  }
  return slots;
}

/**
 * Type per slot op gewicht (mix × prestatieboost), nooit drie keer hetzelfde achter elkaar,
 * en verdeeld zodat het werkelijke aandeel de mix volgt.
 */
export function assignReelTypes(count: number, recent: ReelTemplate[], boost: Partial<Record<ReelTemplate, number>> = {}) {
  const types = Object.keys(REEL_MIX) as ReelTemplate[];
  const usage = new Map<ReelTemplate, number>(types.map((t) => [t, 0]));
  for (const t of recent.slice(-12)) usage.set(t, (usage.get(t) ?? 0) + 1);
  const result: ReelTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const history = [...recent, ...result];
    const blocked = history.length >= 2 && history.at(-1) === history.at(-2) ? history.at(-1) : undefined;
    const pick = types
      .filter((t) => t !== blocked)
      .map((t) => ({ t, score: (usage.get(t) ?? 0) / (REEL_MIX[t] * (boost[t] ?? 1)) }))
      .sort((a, b) => a.score - b.score)[0].t;
    usage.set(pick, (usage.get(pick) ?? 0) + 1);
    result.push(pick);
  }
  return result;
}

/**
 * Doe-het-zelf-adviezen die tegen Support One in gaan (klantmail beantwoorden met sjablonen,
 * macro's, chatbots, ChatGPT) en concurrenten. Een concept met zo'n woord wordt afgekeurd.
 */
const OWN_TURF_WORDS = [
  "sjabloon", "sjablonen", "standaardantwoord", "standaardantwoorden", "vaste antwoorden", "tekstblok", "tekstblokken", "sneltoets", "sneltoetsen", "autoresponder", "chatbot", "chatgpt",
  "template", "templates", "canned response", "canned responses", "saved replies", "macro", "macros", "text expander", "autoreply", "auto-reply",
];
export function contradictsOwnProduct(text: string) {
  const lower = text.toLowerCase();
  const word = OWN_TURF_WORDS.find((w) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "u").test(lower));
  if (word) return `noemt een doe-het-zelf-alternatief voor Support One ("${word}")`;
  const rival = COMPETITOR_GUARD.never.find((name) => lower.includes(name.toLowerCase()));
  if (rival) return `noemt concurrent ${rival}`;
  return null;
}

/** Verboden woorden uit de huisstijl, in beide talen. */
const HYPE = ["magisch", "game changer", "game-changer", "10x", "hustle", "grind", "passief inkomen", "geheim", "hack je brein", "secret", "life hack", "passive income"];
const DASHES = /[—–]/;

/** Onderwerpregel van een reel (voor de uniekheidscheck), los van het type. */
export const reelTopic = (post: Pick<Post, "headline" | "reel">) => (post.reel?.topic || post.headline);

/** Controle van een concept: lengtes, verboden woorden, eigen terrein en uniekheid. Geeft de reden of null. */
export function reviewConcept(concept: { topic: string; texts: string[]; voice: string[] }, existingTopics: string[], limits: { maxVoice: number }) {
  const all = [...concept.texts, ...concept.voice].join(" \n ");
  if (!concept.topic.trim()) return "geen onderwerp";
  const own = contradictsOwnProduct(all);
  if (own) return own;
  const hype = HYPE.find((w) => all.toLowerCase().includes(w));
  if (hype) return `bevat '${hype}'`;
  if (DASHES.test(all)) return "bevat een lang streepje";
  const voiceLength = concept.voice.join(" ").length;
  if (voiceLength > limits.maxVoice) return `voice-over te lang (${voiceLength} tekens)`;
  if (concept.voice.some((v) => !v.trim())) return "lege voice-over";
  const twin = existingTopics.find((t) => isTooSimilar(concept.topic, [t]));
  if (twin) return `lijkt te veel op het bestaande onderwerp "${twin}"`;
  return null;
}

/** Eén bewaar-carrousel per week per taal blijft staan; de rest kan een tips-reel worden. */
export function keptCarouselIds(posts: Array<Pick<Post, "id" | "date" | "time" | "kind" | "status" | "locale" | "parked">>) {
  const kept = new Map<string, string>();
  for (const p of [...posts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
    if ((p.kind && p.kind !== "carousel") || p.status === "rejected" || p.parked) continue;
    const d = parseISO(p.date);
    const key = `${localeOf(p)}-${getISOWeekYear(d)}-${getISOWeek(d)}`;
    if (!kept.has(key)) kept.set(key, p.id);
  }
  return new Set(kept.values());
}

