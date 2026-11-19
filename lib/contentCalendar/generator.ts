import { FORMATS, NEWS, PILLARS, VOICE, brandBrief, factUsedIn, imagePromptFor, newsFor } from "./brand";
import { createGenAiImage, genAiConfigured, getGenAiCredits, getGenAiHistories, getGenAiTask, summarizeCredits } from "./genaiPro";
import { createKieImage, getKieTask, kieConfigured, kieStructured } from "./kie";
import { TIP_BANK } from "./tipBank";
import { getQueue, insertPosts, listPosts, lockQueue, saveMedia, unlockQueue, updatePost, updateQueue } from "./db";
import type { Post, PostDraft, Queue } from "./types";

export { assignFormats, assignPillars, buildSlots } from "./planning.ts";
import { assignFormats, assignPillars, isTooSimilar, slotKey, takenSlots } from "./planning.ts";
import { performanceBoost } from "./performance.ts";
import { byLocale } from "./locale.ts";

/* ---------- Tekst ---------- */

const draftSchema = {
  type: "object",
  properties: {
    pillar: { type: "string" },
    format: { type: "string", enum: FORMATS.map((f) => f.id) },
    factId: { type: "string", enum: ["", ...NEWS.map((n) => n.id)], description: "Bij regels, platform of een seizoensfeit: het id van het gebruikte feit; anders leeg" },
    visual: { type: "string", enum: ["photo", "ui"], description: "'ui' = SaaS-interfacebeeld (bij regels, platform, cijfers, processen, klantcontact), 'photo' = sfeerfoto (bij mensen, producten, pakketten, rust)" },
    template: { type: "string", enum: ["photo", "card"] },
    headline: { type: "string", description: "Coverkop, max 55 tekens, concreet, geen clickbait" },
    subline: { type: "string", description: "Korte ondertitel onder de kop, max 50 tekens" },
    slides: {
      type: "array", minItems: 3, maxItems: 5,
      items: {
        type: "object",
        properties: { title: { type: "string", description: "max 40 tekens, zonder nummer" }, body: { type: "string", description: "max 140 tekens" } },
        required: ["title", "body"],
      },
    },
    caption: { type: "string", description: "Instagram-caption, 2-4 korte alinea's, zonder hashtags, eindigt met een CTA" },
    hashtags: { type: "array", items: { type: "string" }, maxItems: 10 },
    scene: { type: "string", description: "Engels. Bij 'photo': setting, objecten, licht, geen tekst. Bij 'ui': welke interfacekaarten er zweven (bijv. een inboxlijst, een conceptantwoord met knoppen, een grafiekkaart) en hooguit 4 korte labels tussen aanhalingstekens, in het Nederlands." },
  },
  required: ["pillar", "format", "template", "headline", "subline", "slides", "caption", "hashtags", "scene"],
};

const SYSTEM = `Je bent de contentstrateeg van SequenceFlow en schrijft Instagram-carrousels voor e-commerce-ondernemers.
Het doel is waarde geven, geen reclame. Elke post: een cover met kop (over een AI-foto), daarna 3-5 slides, en een caption.
Elke post heeft een pijler (het onderwerp) en een format (de vorm). Vul het format creatief in: een mythe leest anders dan een checklist,
een rekensom anders dan een vraag. Varieer ook in kopstijl (vraag, stelling, getal, 'stop met', 'zo doe je'), slidetitels en caption-opening.
Kies per post het beeld: ongeveer de helft 'ui' (SaaS-interfacebeeld) en de helft 'photo' (sfeerfoto).

${brandBrief()}

Mogelijke CTA's: ${VOICE.ctas.join(" | ")}
Standaard hashtags om uit te kiezen: ${VOICE.hashtags.join(" ")}`;

export function textProvider() {
  return kieConfigured() ? "kie" : "tipbank";
}

export interface DraftSlot {
  date: string;
  pillar: string;
  format: string;
}

/** Feiten voor deze datum die in de 90 dagen ervoor nog niet in een post zaten. */
function freshNews(date: string, existing: Post[]) {
  const since = new Date(new Date(date).getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  const until = new Date(new Date(date).getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
  const nearby = existing.filter((p) => p.status !== "rejected" && p.date >= since && p.date <= until);
  return newsFor(date).filter((n) => !factUsedIn(n, nearby));
}

/** Pijler en format per slot; nieuwsformats alleen als er voor die periode nog onbenutte feiten zijn. */
export function planDrafts(slots: Array<{ date: string }>, existing: Post[]): DraftSlot[] {
  // self-healing: wat bij ons publiek goed scoort, komt vaker terug (begrensd, en pas met genoeg cijfers)
  const pillars = assignPillars(slots.length, existing, performanceBoost(existing, "pillar"));
  const formats = assignFormats(slots.length, existing, slots.some((s) => freshNews(s.date, existing).some((n) => n.kind !== "seizoen")), performanceBoost(existing, "format"));
  return slots.map((slot, i) => ({ date: slot.date, pillar: pillars[i], format: formats[i] }));
}

/** Best scorende posts als inspiratie (kopstijl, invalshoek), niet om te herhalen. */
function winnersPrompt(existing: Post[]) {
  const scored = existing.filter((p) => typeof p.metrics?.score === "number").sort((a, b) => (b.metrics!.score! - a.metrics!.score!));
  if (scored.length < 6) return "";
  const top = scored.slice(0, 3).map((p) => `${p.headline} [${p.pillar}/${p.format ?? "tips"}, score ${p.metrics!.score}]`);
  const bottom = scored.slice(-2).map((p) => `${p.headline} [${p.pillar}/${p.format ?? "tips"}, score ${p.metrics!.score}]`);
  return `Wat bij ons publiek werkt (score 1 = gemiddeld). Leer van de kopstijl en invalshoek van de toppers, herhaal ze niet letterlijk, en vermijd wat de flops deden:\nToppers:\n- ${top.join("\n- ")}\nFlops:\n- ${bottom.join("\n- ")}`;
}

/** De tekst-AI is niet bereikbaar (bijv. kie.ai-credits op): liever wachten dan herhalen. */
export class TextUnavailableError extends Error {}

/**
 * Concepten per slot. Een slot krijgt null als het concept te veel lijkt op een bestaande
 * post; dat slot blijft in de wachtrij en wordt later opnieuw geprobeerd.
 * Faalt de tekst-AI, dan vullen we nooit aan met (herhaalde) reservetips.
 */
export async function generateDrafts(slots: DraftSlot[], existing: Post[]): Promise<Array<PostDraft | null>> {
  const avoid = existing.filter((p) => p.status !== "rejected").map((p) => p.headline);
  const keep = (draft: PostDraft | null) => {
    if (!draft?.headline || isTooSimilar(draft.headline, avoid)) return null;
    avoid.push(draft.headline);
    return draft;
  };
  if (kieConfigured()) {
    try {
      const news = [...new Map(slots.flatMap((s) => freshNews(s.date, existing)).map((n) => [n.id, n])).values()];
      const recent = existing.slice(-40);
      const result = await kieStructured<{ posts: PostDraft[] }>({
        system: SYSTEM,
        toolName: "lever_posts",
        schema: { type: "object", properties: { posts: { type: "array", items: draftSchema } }, required: ["posts"] },
        prompt: [
          `Schrijf ${slots.length} posts, in deze volgorde:\n${slots.map((s, i) => `${i + 1}. ${s.date} · pijler ${s.pillar} (${PILLARS.find((p) => p.id === s.pillar)?.name}) · format ${s.format} (${FORMATS.find((f) => f.id === s.format)?.name})`).join("\n")}`,
          news.length
            ? `Actuele feiten die we de afgelopen tijd nog niet hebben gebruikt (de enige bron voor de formats 'regels' en 'platform', en bruikbaar voor seizoenshaakjes). Gebruik elk feit hooguit in één post, en vul bij die post factId in:\n${news.map((n) => `- [${n.kind}] id=${n.id} · ${n.title}: ${n.fact} Actie: ${n.action}`).join("\n")}`
            : "Er zijn nu geen actuele feiten: schrijf geen nieuws of regels.",
          "Past een seizoensmoment bij de datum, gebruik het dan als haakje. Wissel template af: meestal 'photo', soms 'card'.",
          winnersPrompt(existing),
          recent.length ? `Recente posts (onderwerp, vorm). Herhaal geen onderwerp, invalshoek of kopstijl hieruit:\n- ${recent.map((p) => `${p.headline} [${p.pillar}/${p.format ?? "tips"}] — ${p.slides.map((x) => x.title).join(" / ")}`).join("\n- ")}` : "",
          avoid.length > recent.length ? `Alle andere koppen in de kalender: kies onderwerpen die hier niet op lijken (ook niet met andere woorden):\n- ${avoid.slice(0, -recent.length).slice(-250).join("\n- ")}` : "",
        ].join("\n\n"),
      });
      if (!result.posts?.length) throw new Error("leeg antwoord");
      return slots.map((slot, i) => keep(result.posts[i] ? normalizeDraft(result.posts[i], slot) : null));
    } catch (error) {
      console.error("[generator] kie.ai tekst mislukt:", error);
      throw new TextUnavailableError(`Tekst-AI (kie.ai) werkt niet: ${error instanceof Error ? error.message : error}. Controleer de kie.ai-credits.`);
    }
  }
  // Zonder tekst-AI: alleen reservetips die nog nooit zijn gebruikt
  const drafts = slots.map((slot) => keep(fallbackDraft(slot.pillar, avoid)));
  if (drafts.every((d) => d === null)) throw new TextUnavailableError("Geen tekst-AI gekoppeld en alle reservetips zijn al gebruikt.");
  return drafts;
}

export async function reviseDraft(post: Post, feedback: string): Promise<PostDraft | null> {
  if (!kieConfigured()) return null;
  try {
    const draft = await kieStructured<PostDraft>({
      system: SYSTEM,
      toolName: "lever_post",
      schema: draftSchema,
      prompt: `Verbeter deze post op basis van de feedback. Houd de pijler '${post.pillar}' en het format '${post.format ?? "tips"}', tenzij de feedback om een ander format vraagt.\n\nFeedback: ${feedback}\n\nHuidige post:\n${JSON.stringify({ headline: post.headline, subline: post.subline, slides: post.slides, caption: post.caption, scene: post.scene }, null, 2)}`,
    });
    return normalizeDraft(draft, { pillar: post.pillar, format: draft.format ?? post.format ?? "tips" });
  } catch (error) {
    console.error("[generator] revisie mislukt:", error);
    return null;
  }
}

function normalizeDraft(draft: PostDraft, { pillar, format }: { pillar: string; format: string }): PostDraft {
  return {
    pillar,
    format: FORMATS.some((f) => f.id === format) ? format : "tips",
    ...(draft.factId && NEWS.some((n) => n.id === draft.factId) ? { factId: draft.factId } : {}),
    visual: draft.visual === "ui" ? "ui" : "photo",
    // een interfacebeeld werkt alleen schermvullend: op de card-cover wordt het bijgesneden
    template: draft.template === "card" && draft.visual !== "ui" ? "card" : "photo",
    headline: String(draft.headline ?? "").trim(),
    subline: String(draft.subline ?? "").trim(),
    // de slide heeft al een nummercirkel, dus "1." of "Tip 1:" uit de titel halen
    slides: (draft.slides ?? []).slice(0, 5).map((s) => ({ title: String(s.title ?? "").replace(/^\s*(tip\s*)?\d+\s*[.):-]\s*/i, ""), body: String(s.body ?? "") })),
    caption: String(draft.caption ?? "").trim(),
    hashtags: (draft.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 10),
    scene: String(draft.scene ?? "").trim(),
  };
}

/** Een nog ongebruikte reservetip, het liefst uit dezelfde pijler; met zijn eigen pijler (nooit een verkeerd label). */
function fallbackDraft(pillar: string, avoid: string[]): PostDraft | null {
  const fresh = TIP_BANK.filter((t) => !isTooSimilar(t.headline, avoid));
  const tip = fresh.find((t) => t.pillar === pillar) ?? fresh[0];
  if (!tip) return null;
  const cta = VOICE.ctas[avoid.length % VOICE.ctas.length];
  return {
    ...tip,
    format: "tips",
    template: tip.template ?? (avoid.length % 3 === 2 ? "card" : "photo"),
    caption: `${tip.caption}\n\n${cta}`,
    hashtags: VOICE.hashtags.slice(0, 8),
  };
}

/* ---------- Beelden ---------- */

export function imageProviders() {
  return { genai: genAiConfigured(), kie: kieConfigured() };
}

/**
 * Hoeveel GenAI Pro-credits er nu actief zijn. Kort gecachet (30 s) zodat een batch
 * niet per post de API hoeft te vragen, maar een top-up wel direct wordt opgepikt.
 * null = check mislukt; dan proberen we GenAI Pro gewoon.
 */
const creditCache: { at: number; remaining: number | null; pending?: Promise<void> } = { at: 0, remaining: null };
async function refreshGenAiCredits() {
  if (Date.now() - creditCache.at >= 30_000) {
    creditCache.at = Date.now();
    creditCache.pending = getGenAiCredits()
      .then((packages) => { const { active, remaining } = summarizeCredits(packages); creditCache.remaining = active ? remaining : 0; })
      .catch((error) => { console.error("[images] GenAI Pro-creditcheck mislukt:", error); creditCache.remaining = null; });
  }
  await creditCache.pending;
}

/** Start een beeldgeneratie: GenAI Pro als er actieve credits zijn, anders kie.ai als backup. */
export async function startImage(post: Post, feedback?: string) {
  const prompt = imagePromptFor(feedback ? `${post.scene}. Adjustments requested: ${feedback}` : post.scene, post.visual);
  const base = { files: post.image.files, selected: post.image.selected, prompt, startedAt: new Date().toISOString(), fallbackReason: undefined };
  const errors: string[] = [];
  if (genAiConfigured()) {
    await refreshGenAiCredits();
    const remaining = creditCache.remaining; // na de await lezen: andere posts in de batch kunnen al gereserveerd hebben
    if (remaining === 0) {
      errors.push("GenAI Pro: geen actieve credits");
    } else {
      // credit meteen reserveren, zodat een batch niet meer posts naar GenAI stuurt dan er credits zijn
      if (remaining !== null) creditCache.remaining = remaining - 1;
      try {
        const task = await createGenAiImage({ prompt });
        return await updatePost(post.id, { image: { ...base, status: "generating", provider: "genai", taskId: task.id } });
      } catch (error) {
        creditCache.at = 0; // opnieuw checken bij de volgende post
        errors.push(`GenAI Pro: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  if (kieConfigured()) {
    try {
      const taskId = await createKieImage(prompt);
      return await updatePost(post.id, { image: { ...base, status: "generating", provider: "kie", taskId, fallbackReason: errors[0] } });
    } catch (error) {
      errors.push(`kie.ai: ${error instanceof Error ? error.message : error}`);
    }
  }
  return await updatePost(post.id, {
    image: { ...base, status: "failed", error: errors.join(" · ") || "Geen beeldprovider gekoppeld (GENAIPRO_API_TOKEN of KIE_API_KEY)" },
  });
}

const TIMEOUT_MS = 15 * 60 * 1000;
const lastPoll = new Map<string, number>();
let lastHistoryPoll = 0;
let historyCache = new Map<string, { status: string; urls: string[]; error?: string }>();

async function genAiStatus(taskId: string, pendingGenAi: number) {
  // Bij meerdere lopende taken: één histories-call (30/min) i.p.v. per taak pollen (120/min totaal)
  if (pendingGenAi > 2) {
    if (Date.now() - lastHistoryPoll > 8000) {
      lastHistoryPoll = Date.now();
      const tasks = await getGenAiHistories();
      historyCache = new Map(tasks.map((t) => [t.id, { status: t.status, urls: t.file_urls ?? [], error: t.error }]));
    }
    const hit = historyCache.get(taskId);
    if (hit) return hit;
  }
  const t = await getGenAiTask(taskId);
  return { status: t.status, urls: t.file_urls ?? [], error: t.error };
}

/** Checkt lopende taken en slaat afgeronde beelden lokaal op. */
export async function pollImages(posts: Post[]) {
  const pending = posts.filter((p) => p.image.status === "generating" && p.image.taskId);
  const pendingGenAi = pending.filter((p) => p.image.provider !== "kie").length;
  await Promise.all(pending.map(async (post) => {
    const now = Date.now();
    if (now - (lastPoll.get(post.id) ?? 0) < (pendingGenAi > 2 ? 8000 : 5000)) return;
    lastPoll.set(post.id, now);
    try {
      const { provider, taskId } = post.image;
      const result = provider === "kie" ? await getKieTask(taskId!) : await genAiStatus(taskId!, pendingGenAi);

      if (result.status === "completed" && result.urls.length) {
        const stamp = Date.now();
        const files: string[] = [];
        for (const [index, url] of result.urls.entries()) {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) continue;
          // saveMedia verkleint naar 1080 breed en slaat op als JPEG
          const filename = `${post.id}-${stamp}-${index}.jpg`;
          await saveMedia(filename, await response.arrayBuffer());
          files.push(filename);
        }
        if (!files.length) throw new Error("Beelden konden niet worden gedownload");
        await updatePost(post.id, (current) => ({
          image: { ...current.image, status: "ready", files, selected: 0, error: undefined },
          // nieuw beeld = opnieuw beoordelen
          status: current.status === "rejected" ? "review" : current.status,
        }));
      } else if (result.status === "failed" || (result.status === "completed" && !result.urls.length)) {
        const error = ("error" in result && result.error) || "Generatie mislukt";
        if (provider === "genai" && kieConfigured()) {
          const kieTask = await createKieImage(post.image.prompt ?? imagePromptFor(post.scene, post.visual));
          await updatePost(post.id, { image: { ...post.image, provider: "kie", taskId: kieTask, fallbackReason: `GenAI Pro: ${error}`, startedAt: new Date().toISOString() } });
        } else {
          await updatePost(post.id, { image: { ...post.image, status: "failed", error } });
        }
      } else if (now - new Date(post.image.startedAt ?? 0).getTime() > TIMEOUT_MS) {
        await updatePost(post.id, { image: { ...post.image, status: "failed", error: "Time-out: beeld duurde langer dan 15 minuten" } });
      }
    } catch (error) {
      console.error(`[images] poll ${post.id} mislukt:`, error);
    }
  }));
}

/* ---------- Wachtrij (bulk) ---------- */

const MAX_IN_FLIGHT = 6; // zoveel beelden tegelijk in productie
const BATCH = 3; // zoveel posts per tekstcall
let queueBusy = false;

export async function enqueue(slots: Array<{ date: string; time: string }>) {
  return await updateQueue((current) => {
    const pending = current?.status === "running" ? current.slots : [];
    const known = new Set(pending.map(slotKey));
    const merged = [...pending, ...slots.filter((s) => !known.has(slotKey(s)))].sort((a, b) => slotKey(a).localeCompare(slotKey(b)));
    return {
      id: current?.status === "running" ? current.id : crypto.randomUUID().slice(0, 8),
      status: "running",
      slots: merged,
      total: (current?.status === "running" ? current.done : 0) + merged.length,
      done: current?.status === "running" ? current.done : 0,
      createdAt: current?.status === "running" ? current.createdAt : new Date().toISOString(),
    };
  });
}

export async function stopQueue() {
  return await updateQueue((current) => (current ? { ...current, status: "stopped" } : null));
}

/**
 * Maakt de volgende paar posts uit de wachtrij. Wordt aangeroepen bij elke poll
 * (en straks door een cron). Houdt maximaal MAX_IN_FLIGHT beelden tegelijk in productie.
 */
export async function processQueue(): Promise<Queue | null> {
  if (queueBusy) return null;
  queueBusy = true;
  // lease in de database: cron en de open pagina kunnen op verschillende servers draaien
  if (!(await lockQueue().catch(() => false))) { queueBusy = false; return null; }
  try {
    const queue = await getQueue();
    if (!queue || queue.status !== "running") return queue;
    if (queue.pausedUntil && new Date(queue.pausedUntil).getTime() > Date.now()) return queue;
    if (!queue.slots.length) return await updateQueue((q) => (q ? { ...q, status: "done" } : q));

    // de generator schrijft Nederlands; Engelse posts (vertalingen) tellen niet mee voor slots en onderwerpen
    const posts = byLocale(await listPosts(), "nl");
    const inFlight = posts.filter((p) => p.image.status === "generating").length;
    const room = Math.min(BATCH, MAX_IN_FLIGHT - inFlight);
    if (room <= 0) return queue;

    const taken = takenSlots(posts);
    const free = queue.slots.filter((s) => !taken.has(slotKey(s)));
    const batch = free.slice(0, room);
    if (!batch.length) return await updateQueue((q) => (q ? { ...q, slots: [], status: "done" } : q));

    try {
      const drafts = await generateDrafts(planDrafts(batch, posts), posts);
      const now = new Date().toISOString();
      const created: Post[] = batch.flatMap((slot, i) => {
        const draft = drafts[i];
        if (!draft) return []; // te veel zoals een bestaande post: slot blijft staan voor een nieuwe poging
        return [{
          id: crypto.randomUUID().slice(0, 8),
          ...slot,
          ...draft,
          image: { status: "none" as const, files: [], selected: 0 },
          status: "review" as const,
          createdAt: now,
          updatedAt: now,
        }];
      });
      if (!created.length) {
        return await updateQueue((q) => (q ? { ...q, lastError: "Concepten leken te veel op bestaande posts; nieuwe poging over een paar minuten", pausedUntil: new Date(Date.now() + 5 * 60_000).toISOString() } : q));
      }
      await insertPosts(created);
      // één voor één starten: vriendelijk voor de rate limit (30/min)
      for (const post of created) await startImage(post);
      const doneDates = new Set(created.map(slotKey));
      return await updateQueue((q) => {
        if (!q) return q;
        const slots = q.slots.filter((s) => !doneDates.has(slotKey(s)) && !taken.has(slotKey(s)));
        return { ...q, slots, done: q.done + created.length, lastError: undefined, pausedUntil: undefined, status: slots.length ? q.status : "done" };
      });
    } catch (error) {
      console.error("[queue] batch mislukt:", error);
      // tekst-AI weg (credits op): niet elke paar seconden opnieuw proberen
      const pauseMs = error instanceof TextUnavailableError ? 15 * 60_000 : 30_000;
      return await updateQueue((q) => (q ? { ...q, lastError: error instanceof Error ? error.message : String(error), pausedUntil: new Date(Date.now() + pauseMs).toISOString() } : q));
    }
  } finally {
    queueBusy = false;
    await unlockQueue().catch(() => undefined);
  }
}
