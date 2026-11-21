import { AUDIENCE, BRAND, COMPETITOR_GUARD, EN_HANDLE, PILLARS, VOICE } from "./brand";
import { parseISO } from "date-fns";
import { insertPosts, listPosts, updatePost } from "./db";
import { kieStructured } from "./kie";
import { byLocale, type Locale } from "./locale.ts";
import { performanceBoost } from "./performance.ts";
import { captionRule, cleanInvisible, findSlop, hookInstruction, pickHook, reviewCaption } from "./copy.ts";
import { assignReelTypes, keptCarouselIds, reelSlots, reelTopic, reviewConcept } from "./reelPlan.ts";
import type { Post, ReelSpec, ReelTemplate } from "./types";

/**
 * Reel-generator: schrijft per slot een concept (kie.ai) volgens de formule hook → vraag → antwoord → beloning.
 * Tips-reels komen uit de bestaande carrousels (die gaan daarna niet meer als carrousel); aware en unaware zijn nieuw.
 * De reel-worker op de server maakt er stem en video van.
 */

const HANDLE: Record<Locale, string> = { nl: BRAND.handle, en: EN_HANDLE };
const FOLLOW: Record<Locale, string> = {
  nl: "Volg SequenceFlow voor dagelijkse inzichten om je bedrijf te verbeteren.",
  en: "Follow SequenceFlow for daily insights to grow your business.",
};
const TRIAL: Record<Locale, string> = {
  nl: "Probeer Support One veertien dagen gratis. De link staat in de bio.",
  en: "Try Support One free for fourteen days. The link is in the bio.",
};
const MAX_VOICE = 760;

const PRODUCT_FACTS = [
  "Support One met Seffy (klantenservice): leest klantmail, zoekt de bestelling erbij (Shopify, WooCommerce, bol) en het eigen beleid van de winkel, en zet een antwoordconcept klaar in de toon van de winkel. De ondernemer keurt goed; vanaf Growth kan het automatisch versturen voor soorten vragen die je vertrouwt. Leert van wat je aanpast. 14 dagen gratis.",
  "Otis (voorraad en inkoop, in Support One Scale met een gekoppeld verkoopkanaal): ziet per variant welke producten bijna op zijn en geeft inkoopadvies; jij keurt het advies goed.",
  "Verzin geen resultaten of percentages over onze producten. Geen klantcases verzinnen.",
].join("\n");

function localeRules(locale: Locale) {
  return locale === "en"
    ? [
        "Write in natural, plain American English for US e-commerce founders (Shopify and WooCommerce stores, small teams). Use dollars, US carriers (USPS, UPS) and Amazon when you need examples.",
        "Do not mention Dutch or EU laws, VAT, iDEAL, bol or PostNL.",
        "Short spoken sentences: the voice-over is read aloud by a voice actor. Write numbers in the voice-over as words where that reads more naturally.",
      ].join(" ")
    : [
        "Schrijf in het Nederlands, je-vorm, voor e-commerce-ondernemers in Nederland en België. Euro's, PostNL en bol mogen als voorbeeld.",
        "Korte gesproken zinnen: de voice-over wordt voorgelezen door een stemacteur. Schrijf getallen in de voice-over uit als woorden waar dat natuurlijker klinkt (zoals 'twee komma twee procent').",
      ].join(" ");
}

const SYSTEM = (locale: Locale) => [
  `Je schrijft korte verticale video's (reels) voor ${BRAND.name}. ${BRAND.mission}`,
  `Doelgroep: ${AUDIENCE.who}`,
  `Stem: ${VOICE.personality}`,
  "Formule voor elke reel: HOOK (de eerste 2 seconden: een herkenbaar probleem of een verrassende stelling, geen begroeting) → VRAAG (de vraag die nieuwsgierig maakt) → ANTWOORD (concreet, toepasbaar) → BELONING (het sterkste inzicht of cijfer bewaar je voor het einde, zodat mensen blijven kijken).",
  "Content die ondernemers willen bewaren en doorsturen. Eén onderwerp per reel, concreet en nuchter.",
  `Vermijd: ${[...VOICE.avoid, "lange streepjes (— of –)", "emoji's in de beeldtekst"].join(", ")}.`,
  `Concurrenten nooit noemen of aanraden: ${COMPETITOR_GUARD.never.join(", ")}. ${COMPETITOR_GUARD.rule}`,
  "Adviseer nooit tegen onze eigen producten in: geen sjablonen, standaardantwoorden, macro's, sneltoetsen, autoresponders, chatbots of ChatGPT voor het beantwoorden van klantmail (dat doet Support One). Geen AI-tools voor social content aanraden.",
  "Verzin geen wetten, onderzoeken of statistieken. Presenteer nooit een percentage, gemiddelde of effect als feit (zoals 'fouten stijgen met 25%' of '80% van je omzet komt uit een paar producten'). Cijfers alleen in een rekenvoorbeeld dat begint met 'stel' of 'bijvoorbeeld', met eigen voorbeeldgetallen, en reken ze goed uit.",
  localeRules(locale),
].join("\n");

const pillarIds = PILLARS.map((p) => p.id);
// lengte als beschrijving: Gemini via kie.ai struikelt over maxLength in het schema
const str = (max: number) => ({ type: "string", description: `max ${max} tekens` });

const SCHEMAS: Record<ReelTemplate, Record<string, unknown>> = {
  tips: {
    type: "object",
    properties: {
      topic: str(80), pillar: { type: "string", enum: pillarIds }, label: str(24), headline: str(62), subline: str(60),
      tips: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", properties: { title: str(42), body: str(110) }, required: ["title", "body"] } },
      voice: { type: "object", properties: { hook: str(170), tips: { type: "array", items: str(170) }, outro: str(170) }, required: ["hook", "tips", "outro"] },
      caption: str(300),
    },
    required: ["topic", "pillar", "label", "headline", "subline", "tips", "voice", "caption"],
  },
  aware: {
    type: "object",
    properties: {
      topic: str(80), pillar: { type: "string", enum: pillarIds }, agent: { type: "string", enum: ["seffy", "otis"] },
      hook: str(52), pains: { type: "array", minItems: 4, maxItems: 5, items: str(36) }, question: str(56),
      answer: { type: "object", properties: { title: str(32), request: str(48), reply: str(170), facts: { type: "array", minItems: 2, maxItems: 3, items: str(30) } }, required: ["title", "request", "reply", "facts"] },
      reward: str(62), voice: { type: "array", minItems: 4, maxItems: 4, items: str(190) }, caption: str(300),
    },
    required: ["topic", "pillar", "agent", "hook", "pains", "question", "answer", "reward", "voice", "caption"],
  },
  unaware: {
    type: "object",
    properties: {
      topic: str(80), pillar: { type: "string", enum: pillarIds }, label: str(22), hook: str(72), hookHighlight: { type: "array", maxItems: 2, items: str(20) }, question: str(80),
      // plat in plaats van geneste optionele objecten: daar struikelt Gemini via kie.ai over
      steps: { type: "array", minItems: 2, maxItems: 3, items: { type: "object", properties: { text: str(92), statValue: { type: "number", description: "optioneel: het getal dat in beeld optelt" }, statPrefix: str(4), statSuffix: str(6), statLabel: str(32) }, required: ["text"] } },
      rewardText: str(112), rewardHighlight: { type: "array", maxItems: 3, items: str(20) }, rewardValue: { type: "number", description: "optioneel: eindcijfer" }, rewardPrefix: str(4), rewardSuffix: str(6),
      cameo: { type: "string", enum: ["otis", "seffy", "none"] },
      voice: { type: "array", minItems: 4, maxItems: 6, items: str(200) }, caption: str(300),
    },
    required: ["topic", "pillar", "label", "hook", "question", "steps", "rewardText", "cameo", "voice", "caption"],
  },
};

const INSTRUCTIONS: Record<ReelTemplate, (locale: Locale) => string> = {
  tips: (locale) => [
    "TIPS-REEL: zet de gegeven carrousel om naar een reel. Behoud onderwerp en tips, maar schrijf het als reel.",
    "headline: de hook op het scherm (max ~8 woorden). subline: de vraag of belofte eronder. label: korte categorie.",
    "tips: precies 3, kies de drie sterkste uit de carrousel (titel kort, body één of twee zinnen). Bewaar de sterkste tip voor de laatste plek. Kort houden: de hele reel duurt ongeveer 30 seconden.",
    `voice.hook: hook plus vraag, gesproken. voice.tips: per tip één tot twee zinnen, begin met het rangtelwoord (${locale === "en" ? "One. / Two." : "Eén. / Twee."}). voice.outro: de beloning in één zin, eindig met: "${FOLLOW[locale]}"`,
  ].join("\n"),
  aware: (locale) => [
    "AWARE-REEL: een herkenbaar pijnpunt waar Support One het antwoord op is. Kies agent 'seffy' voor klantmail/klantvragen, 'otis' voor voorraad/inkoop.",
    "hook: het pijnpunt groot in beeld, als vraag. pains: 4 of 5 korte berichten van klanten (seffy) of meldingen/vragen over voorraad (otis), zoals ze echt binnenkomen.",
    "question: de vraag die het probleem openbreekt (waarom kost dit zoveel tijd/geld?). answer: wat de agent laat zien: title (bijv. 'Nieuwe mail · Lisa' of 'Voorraadsignaal'), request (de vraag of het signaal), reply (het concept-antwoord of advies van de agent, concreet), facts (2-3 korte vinkjes van wat de agent erbij zocht).",
    "Het antwoord van de agent is een concept dat de ondernemer nog goedkeurt: de agent voert niets uit en zegt niet dat iets al gedaan is ('we hebben je adres aangepast', 'je geld is teruggestort'). Het concept mag wel zeggen wat er gaat gebeuren. Laat de agent alleen doen wat in de productfeiten staat (niets 'verifiëren' of 'controleren' wat daar niet staat).",
    `reward: de uitkomst in één zin (bijv. 'Jij keurt goed. Seffy doet de rest.'). voice: precies 4 delen: [hook, vraag, oplossing met de agent, beloning]. Het laatste deel eindigt met: "${TRIAL[locale]}"`,
    `Wat de producten echt doen (niets anders beloven):\n${PRODUCT_FACTS}`,
  ].join("\n"),
  unaware: (locale) => [
    "UNAWARE-REEL: inhoudelijk en zonder product. Voor ondernemers die het probleem nog niet zien: een rekensom, een denkfout, een verrassend inzicht over e-commerce of ondernemen.",
    "hook: een verrassende stelling (hookHighlight: 1 of 2 woorden uit de hook die de markeerstift krijgen). question: de vraag die het oplost. steps: 2 of 3 stappen; zit er een cijfer in, vul dan statValue (alleen het getal), statPrefix (zoals '€' of '$'), statSuffix (zoals '%') en statLabel (wat het getal is). rewardText: het inzicht of eindcijfer, met wat je ermee doet; rewardHighlight: 1-3 woorden daaruit; rewardValue/rewardPrefix/rewardSuffix als het eindcijfer groot in beeld moet.",
    "cameo: soms een gastoptreden aan het eind: 'otis' bij cijfers/voorraad, 'seffy' bij klanten, anders 'none' (ongeveer 1 op de 3 heeft een cameo).",
    `voice: precies 2 + aantal stappen + 1 delen: [hook, vraag, stap 1, stap 2, (stap 3), beloning]. Het laatste deel eindigt met: "${FOLLOW[locale]}"`,
  ].join("\n"),
};

type Draft = Record<string, unknown> & { topic: string; pillar: string; caption: string };

/** Concept omzetten naar de props en stemtekst van het template. */
function toSpec(template: ReelTemplate, d: Draft, locale: Locale, music: number): { spec: ReelSpec; headline: string; subline: string; texts: string[]; voice: string[] } {
  const handle = HANDLE[locale];
  if (template === "tips") {
    const tips = d.tips as Array<{ title: string; body: string }>;
    const v = d.voice as { hook: string; tips: string[]; outro: string };
    const props = { locale, handle, label: d.label, headline: d.headline, subline: d.subline, tips, music };
    const voiceText = { hook: v.hook, tips: tips.map((_, i) => v.tips[i] ?? ""), outro: v.outro };
    return { spec: { template, topic: d.topic, props, voiceText, status: "concept" }, headline: String(d.headline), subline: String(d.subline), texts: [String(d.headline), String(d.subline), ...tips.flatMap((t) => [t.title, t.body]), d.caption], voice: [voiceText.hook, ...voiceText.tips, voiceText.outro] };
  }
  if (template === "aware") {
    const answer = d.answer as { title: string; request: string; reply: string; facts: string[] };
    const props = { locale, handle, agent: d.agent, hook: d.hook, pains: d.pains, question: d.question, answer, reward: d.reward, music };
    const parts = d.voice as string[];
    return { spec: { template, topic: d.topic, props, voiceText: { parts }, status: "concept" }, headline: String(d.hook), subline: String(d.question), texts: [String(d.hook), ...(d.pains as string[]), String(d.question), answer.reply, ...answer.facts, String(d.reward), d.caption], voice: parts };
  }
  type FlatStep = { text: string; statValue?: number; statPrefix?: string; statSuffix?: string; statLabel?: string };
  const stat = (value: unknown, prefix: unknown, suffix: unknown, label: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? { value, prefix: prefix ? String(prefix) : undefined, suffix: suffix ? String(suffix) : undefined, label: String(label ?? "") } : undefined;
  const steps = (d.steps as FlatStep[]).map((st) => ({ text: st.text, stat: stat(st.statValue, st.statPrefix, st.statSuffix, st.statLabel) }));
  const reward = { text: String(d.rewardText ?? ""), highlight: (d.rewardHighlight as string[] | undefined) ?? [], stat: stat(d.rewardValue, d.rewardPrefix, d.rewardSuffix, "") };
  const parts = d.voice as string[];
  const cameo = d.cameo === "none" ? null : d.cameo;
  if (!reward.text) throw new Error("beloning ontbreekt");
  const props = { locale, handle, label: d.label, hook: d.hook, hookHighlight: d.hookHighlight ?? [], question: d.question, steps, reward, cameo, music };
  return { spec: { template, topic: d.topic, props, voiceText: { parts }, status: "concept" }, headline: String(d.hook), subline: String(d.question), texts: [String(d.hook), String(d.question), ...steps.map((s) => s.text), reward.text, d.caption], voice: parts };
}

/** Klopt de vorm van een concept (aantallen delen)? */
function shapeError(template: ReelTemplate, d: Draft) {
  if (template === "tips") {
    const tips = d.tips as unknown[]; const v = d.voice as { tips?: unknown[] };
    if (!Array.isArray(tips) || tips.length !== 3) return "aantal tips";
    if (!Array.isArray(v?.tips) || v.tips.length !== tips.length) return "voice per tip ontbreekt";
  }
  if (template === "aware" && (d.voice as unknown[])?.length !== 4) return "aware heeft 4 stemdelen nodig";
  if (template === "unaware" && (d.voice as unknown[])?.length !== 2 + ((d.steps as unknown[])?.length ?? 0) + 1) return "aantal stemdelen past niet bij de stappen";
  return null;
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Maakt reel-concepten voor een taal over een periode. Geeft per slot het resultaat terug.
 * Tips-reels nemen een carrousel van rond dezelfde datum als bron; die carrousel gaat daarna niet meer live.
 */
export async function generateReels({ locale, from, days, max = 12, budgetMs = 230_000 }: { locale: Locale; from: string; days: number; max?: number; budgetMs?: number }) {
  const started = Date.now();
  const all = await listPosts();
  const mine = byLocale(all, locale);
  const reels = mine.filter((p) => p.kind === "reel");
  const slots = reelSlots(locale, from, days, all).slice(0, max);
  // alleen wat vóór deze periode staat telt als "recent", anders bepalen latere reels de mix
  const recentTypes = reels.filter((p) => p.reel && p.status !== "rejected" && p.date < from).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((p) => p.reel!.template);
  const boost = performanceBoost(reels.filter((p) => p.reel).map((p) => ({ ...p, format: p.reel!.template })), "format") as Partial<Record<ReelTemplate, number>>;
  const types = assignReelTypes(slots.length, recentTypes, boost);
  // uniek tussen alle reels; carrousels alleen als ze dichtbij staan (zelfde onderwerp twee maanden later in een ander format mag)
  const near = (date: string) => Math.abs(parseISO(date).getTime() - parseISO(from).getTime()) <= (days + 14) * 86_400_000;
  const topics = [
    ...reels.filter((p) => p.status !== "rejected").map((p) => reelTopic(p)),
    ...mine.filter((p) => (!p.kind || p.kind === "carousel") && p.status !== "rejected" && near(p.date)).map((p) => p.headline),
  ];
  const usedSources = new Set(reels.map((p) => p.sourceId).filter(Boolean));
  const kept = keptCarouselIds(mine);
  const sources = mine
    .filter((p) => (!p.kind || p.kind === "carousel") && !["posted", "rejected"].includes(p.status) && !kept.has(p.id) && !usedSources.has(p.id) && (p.date >= from || Boolean(p.parked)))
    .sort((a, b) => a.date.localeCompare(b.date));
  // hook-formules: afwisselen, en vaker kiezen wat bij dit account goed scoorde
  const recentHooks = reels.filter((p) => p.reel?.hook && p.status !== "rejected" && p.date < from).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((p) => p.reel!.hook!);
  const hookBoost = performanceBoost(reels.filter((p) => p.reel?.hook).map((p) => ({ ...p, format: String(p.reel!.hook) })), "format");
  const winners = reels.filter((p) => typeof p.metrics?.score === "number").sort((a, b) => b.metrics!.score! - a.metrics!.score!);
  const learnings = [
    winners.length ? `Reels die goed deden (meer van deze hooks/onderwerpen): ${winners.slice(0, 5).map((p) => `"${p.headline}" (${p.reel?.template})`).join("; ")}` : "",
    winners.length > 5 ? `Reels die slecht deden (vermijd deze aanpak): ${winners.slice(-3).map((p) => `"${p.headline}" (${p.reel?.template})`).join("; ")}` : "",
  ].filter(Boolean).join("\n");

  const results: Array<{ date: string; time: string; template: ReelTemplate; ok: boolean; id?: string; headline?: string; error?: string }> = [];
  const created: Post[] = [];
  const converted: string[] = [];
  for (const [i, slot] of slots.entries()) {
    // binnen de tijd van één aanvraag blijven; de rest komt bij de volgende aanroep
    if (Date.now() - started > budgetMs) { results.push({ ...slot, template: types[i], ok: false, error: "tijd op, volgende ronde" }); continue; }
    const template = types[i];
    const source = template === "tips" ? sources.find((s) => !converted.includes(s.id) && s.date >= slot.date) ?? sources.find((s) => !converted.includes(s.id)) : undefined;
    if (template === "tips" && !source) { results.push({ ...slot, template, ok: false, error: "geen carrousel meer om om te zetten" }); continue; }
    const hook = pickHook(template, recentHooks, hookBoost, hash(`${slot.date}${slot.time}${locale}`));
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const draft = await kieStructured<Draft>({
          system: SYSTEM(locale),
          toolName: `reel_${template}`,
          schema: SCHEMAS[template],
          prompt: [
            INSTRUCTIONS[template](locale),
            hookInstruction(hook, locale),
            source ? `Carrousel om om te zetten:\nKop: ${source.headline}\nOndertitel: ${source.subline}\nTips:\n${source.slides.map((s, n) => `${n + 1}. ${s.title}: ${s.body}`).join("\n")}` : "",
            learnings,
            `Onderwerpen die al bestaan; kies iets wat hier duidelijk niet op lijkt, ook niet met andere woorden:\n- ${topics.slice(-200).join("\n- ")}`,
            lastError ? `Je vorige poging werd afgekeurd: ${lastError}. Los dat op.` : "",
            captionRule(locale),
          ].filter(Boolean).join("\n\n"),
        });
        const shape = shapeError(template, draft);
        if (shape) throw new Error(shape);
        const music = (hash(`${slot.date}${slot.time}${locale}`) % 3) + 1;
        const built = toSpec(template, draft, locale, music);
        // een tips-reel mag op zijn eigen bron-carrousel lijken
        const compare = source ? topics.filter((t) => t !== source.headline) : topics;
        const problem = reviewConcept({ topic: draft.topic, texts: built.texts.map(String), voice: built.voice.map(String) }, compare, { maxVoice: MAX_VOICE });
        if (problem) throw new Error(problem);
        const caption = cleanInvisible(String(draft.caption)).trim();
        const copyProblem = reviewCaption(caption) ?? findSlop([...built.texts.map(String), ...built.voice.map(String), caption].join("\n"), locale);
        if (copyProblem) throw new Error(copyProblem);
        built.spec.hook = hook.id;
        const now = new Date().toISOString();
        const post: Post = {
          id: `reel-${locale}-${slot.date}-${slot.time.replace(":", "")}`,
          ...(locale === "en" ? { locale } : {}),
          kind: "reel",
          ...(source ? { sourceId: source.id } : {}),
          date: slot.date,
          time: slot.time,
          pillar: pillarIds.includes(draft.pillar) ? draft.pillar : "tijd",
          template: "photo",
          headline: built.headline,
          subline: built.subline,
          slides: [],
          caption,
          hashtags: [],
          scene: "",
          image: { status: "none", files: [], selected: 0 },
          status: "review",
          reel: built.spec,
          createdAt: now,
          updatedAt: now,
        };
        // meteen opslaan, zodat een time-out niets kwijtmaakt
        await insertPosts([post]);
        if (source) await updatePost(source.id, { status: "rejected", feedback: `Omgezet naar tips-reel (${post.id})` });
        created.push(post);
        topics.push(draft.topic);
        recentHooks.push(hook.id);
        if (source) converted.push(source.id);
        results.push({ ...slot, template, ok: true, id: post.id, headline: post.headline });
        lastError = "";
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`[reels] ${locale} ${slot.date} ${slot.time} ${template} poging ${attempt + 1}:`, lastError);
      }
    }
    if (lastError) results.push({ ...slot, template, ok: false, error: lastError });
  }
  return { results, created: created.length, converted: converted.length, remaining: results.filter((r) => !r.ok).length };
}

/* ---------- Render-wachtrij voor de server ---------- */

const CLAIM_TIMEOUT_MS = 30 * 60_000;
const MAX_RENDER_ATTEMPTS = 3;

/** Reels die de server nu kan maken: nieuwe concepten, vastgelopen claims en mislukte pogingen (na een uur). */
export function renderable(posts: Post[], now = Date.now()) {
  return posts
    .filter((p) => {
      const r = p.reel;
      if (!r || p.status === "rejected" || p.status === "posted") return false;
      if (r.status === "concept") return true;
      if (r.status === "rendering") return now - new Date(r.claimedAt ?? 0).getTime() > CLAIM_TIMEOUT_MS;
      if (r.status === "failed") return (r.attempts ?? 0) < MAX_RENDER_ATTEMPTS && now - new Date(r.claimedAt ?? 0).getTime() > 60 * 60_000;
      return false;
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export async function claimReel(id: string) {
  let ok = false;
  await updatePost(id, (current) => {
    if (!current.reel || !renderable([current]).length) return {};
    ok = true;
    return { reel: { ...current.reel, status: "rendering", claimedAt: new Date().toISOString(), attempts: (current.reel.attempts ?? 0) + 1, error: undefined } };
  });
  return ok;
}

export const reelFiles = (id: string) => ({ video: `${id}-reel.mp4`, cover: `${id}-cover.jpg` });

export async function finishReel(id: string, seconds: number) {
  const files = reelFiles(id);
  return await updatePost(id, (current) => ({
    video: { file: files.video, cover: files.cover },
    image: { status: "ready", files: [files.cover], selected: 0 },
    reel: { ...current.reel!, status: "ready", renderedAt: new Date().toISOString(), seconds, error: undefined },
  }));
}

export async function failReel(id: string, error: string) {
  return await updatePost(id, (current) => ({ reel: { ...current.reel!, status: "failed", error: error.slice(0, 500) } }));
}

/**
 * Opruimen: de video van een gegenereerde reel 2 dagen na publicatie op Instagram uit de opslag halen
 * (de cover blijft). Niet zolang TikTok nog bezig is of het opnieuw moet proberen.
 */
export async function cleanupReelVideos(posts: Post[], now = Date.now()) {
  const old = posts.filter((p) => {
    const t = p.publish?.tiktok;
    return p.reel && p.status === "posted" && p.video?.file && !p.reel.videoDeletedAt && p.publish?.instagram?.at
      && now - new Date(p.publish.instagram.at).getTime() > 48 * 3_600_000
      && (!t || t.status === "inbox" || t.status === "published" || (t.attempts ?? 1) >= 4);
  }).slice(0, 10);
  if (!old.length) return { deleted: 0 };
  const { deleteMedia } = await import("./db");
  await deleteMedia(old.map((p) => p.video!.file));
  for (const p of old) await updatePost(p.id, (current) => ({ reel: { ...current.reel!, videoDeletedAt: new Date().toISOString() } }));
  return { deleted: old.length };
}
