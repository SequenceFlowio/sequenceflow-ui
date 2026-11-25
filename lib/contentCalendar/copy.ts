import data from "./copyData.json" with { type: "json" };
import type { Locale } from "./locale.ts";
import type { ReelTemplate } from "./types.ts";

/**
 * Schrijfregels voor de generator: hook-formules (afwisseling in openingen), een lijst met
 * typische AI-woorden die we afkeuren, en korte captions zonder hashtags.
 * Bron van de formules en woordenlijst: instagram-agent-skill (MIT), zie copyData.json.
 */

export type HookFormula = { id: number; name: string; template: string; example: string; onScreen: string; trap: string; for: string[] };
export const HOOKS = data.hooks as HookFormula[];

/**
 * Hook-formule voor de volgende reel van dit type: niet een van de laatste 8,
 * met voorkeur (boost) voor formules die bij dit account goed scoorden.
 */
export function pickHook(template: ReelTemplate, recent: number[], boost: Record<string, number> = {}, seed = 0): HookFormula {
  const options = HOOKS.filter((h) => h.for.includes(template));
  const fresh = options.filter((h) => !recent.slice(-8).includes(h.id));
  const pool = fresh.length ? fresh : options;
  const used = (id: number) => recent.filter((r) => r === id).length;
  const ranked = [...pool].sort((a, b) => used(a.id) / (boost[a.id] ?? 1) - used(b.id) / (boost[b.id] ?? 1) || ((a.id * 7 + seed) % 17) - ((b.id * 7 + seed) % 17));
  return ranked[0];
}

export function hookInstruction(hook: HookFormula, locale: Locale) {
  return [
    `Hook-formule voor deze reel: "${hook.name}". Patroon: ${hook.template}`,
    `Voorbeeld (Engels, alleen ter inspiratie, niet vertalen): ${hook.example} · op het scherm: ${hook.onScreen}`,
    `Valkuil: ${hook.trap}`,
    `Gebruik dit patroon voor de gesproken hook en de tekst op het scherm, in het ${locale === "en" ? "Engels" : "Nederlands"}. Wij zijn een merk, geen persoon: verzin geen eigen ervaringen ('ik heb...', 'het kostte me') en geen cijfers als feit.`,
  ].join("\n");
}

/** Nederlandse AI-woorden en -zinnen (eigen lijst, zelfde idee als de Engelse). */
const SLOP_NL = [
  "in de snel veranderende wereld", "in de huidige digitale wereld", "in een wereld waarin", "naadloos", "naadloze", "revolutionair", "baanbrekend", "duik in", "duiken we in",
  "ontketen", "ontgrendel", "til je", "naar een hoger niveau", "next level", "cruciaal", "essentieel", "onmisbaar", "een wereld van verschil", "het geheime ingrediënt",
  "laat het even bezinken", "lees dat nog eens", "niemand praat hierover", "scroll niet verder", "stop met scrollen", "spoiler", "kortom", "al met al", "bovendien", "daarnaast is het belangrijk",
  "het is geen geheim dat", "stel je een wereld voor", "speelveld", "holistisch", "synergie", "robuust", "transformeer", "transformatief",
];
const SLOP_EN = data.slopEn as string[];
const STRUCTURES = (data.structures as Array<{ id: string; name: string; regex: string }>).map((s) => ({ ...s, re: new RegExp(s.regex, s.id === "caps-shout" ? "mu" : "imu") }));
// onzichtbare tekens (watermerken) weg, afwijkende spaties worden een gewone spatie
const INVISIBLE = /[\u200B-\u200F\u2060-\u2064\uFEFF\u00AD\u180E\u061C\u{E0000}-\u{E007F}]/gu;
const ODD_SPACES = /[\u00A0\u202F\u2009\u2007\u2003\u2002]/g;

const hasPhrase = (lower: string, phrase: string) => new RegExp(`(^|[^\\p{L}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(lower);

/** Eerste AI-woord of -zinsbouw in de tekst, of null. */
export function findSlop(text: string, locale: Locale) {
  const lower = text.toLowerCase().replace(/’/g, "'");
  const word = (locale === "en" ? SLOP_EN : SLOP_NL).find((w) => hasPhrase(lower, w));
  if (word) return `klinkt als AI ("${word}")`;
  if (locale === "en") {
    const structure = STRUCTURES.find((s) => s.re.test(text));
    if (structure) return `klinkt als AI (zinsbouw ${structure.name})`;
  }
  return null;
}

/** Onzichtbare tekens (watermerken) weghalen. */
export const cleanInvisible = (text: string) => text.replace(INVISIBLE, "").replace(ODD_SPACES, " ");

/** Captions: kort, de eerste regel doet het werk (Instagram toont ~125 tekens), geen hashtags. */
export const CAPTION_MAX = 300;
export const CAPTION_FIRST_LINE = 125;
export function captionRule(locale: Locale) {
  return `Caption: kort, max ${CAPTION_MAX} tekens, in het ${locale === "en" ? "Engels" : "Nederlands"}. De eerste regel (max ${CAPTION_FIRST_LINE} tekens) is de hook of de belofte: geen begroeting, geen emoji vooraan. Daarna hooguit één of twee korte zinnen. Geen slotoproep (niet bewaren, delen, volgen of reageren): de oproep voor de gratis Academy zetten wij er zelf onder. Geen hashtags; zet de zoekterm waarop je gevonden wilt worden gewoon in een zin.`;
}

export function reviewCaption(caption: string) {
  const text = caption.trim();
  if (!text) return "lege caption";
  if (/(^|\s)#[\p{L}\p{N}_]+/u.test(text)) return "caption bevat hashtags";
  if (text.length > CAPTION_MAX) return `caption te lang (${text.length} tekens, max ${CAPTION_MAX})`;
  if (text.split("\n")[0].length > CAPTION_FIRST_LINE) return `eerste regel van de caption te lang (max ${CAPTION_FIRST_LINE} tekens)`;
  return null;
}

/** Bestaande caption inkorten: hashtags eruit, eerste zinnen als hook (max 125 tekens) plus de slotoproep. */
export function shortenCaption(caption: string) {
  const paragraphs = caption.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return "";
  const joined = paragraphs.join("\n\n");
  if (!reviewCaption(joined)) return joined;
  const sentences = paragraphs[0].match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g)?.map((s) => s.trim()) ?? [paragraphs[0]];
  let first = sentences[0];
  for (const s of sentences.slice(1)) if ((first + " " + s).length <= CAPTION_FIRST_LINE) first += " " + s; else break;
  const last = paragraphs.length > 1 ? paragraphs.at(-1)! : "";
  const result = last && first.length + last.length + 2 <= CAPTION_MAX ? `${first}\n\n${last}` : first;
  return result.length <= CAPTION_MAX ? result : result.slice(0, CAPTION_MAX - 1).replace(/\s+\S*$/, "") + "…";
}
