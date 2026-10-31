import { VOICE, brandBrief, imagePromptFor } from "./brand";
import { createGenAiImage, genAiConfigured, getGenAiCredits, getGenAiHistories, getGenAiTask, summarizeCredits } from "./genaiPro";
import { createKieImage, getKieTask, kieConfigured, kieStructured } from "./kie";
import { TIP_BANK } from "./tipBank";
import { getQueue, insertPosts, listPosts, lockQueue, saveMedia, unlockQueue, updatePost, updateQueue } from "./db";
import type { Post, PostDraft, Queue } from "./types";

export { assignPillars, buildSlots } from "./planning.ts";
import { assignPillars } from "./planning.ts";

/* ---------- Tekst ---------- */

const draftSchema = {
  type: "object",
  properties: {
    pillar: { type: "string" },
    template: { type: "string", enum: ["photo", "card"] },
    headline: { type: "string", description: "Coverkop, max 55 tekens, concreet, geen clickbait" },
    subline: { type: "string", description: "Korte ondertitel onder de kop, max 50 tekens" },
    slides: {
      type: "array", minItems: 3, maxItems: 5,
      items: {
        type: "object",
        properties: { title: { type: "string", description: "max 40 tekens" }, body: { type: "string", description: "max 140 tekens" } },
        required: ["title", "body"],
      },
    },
    caption: { type: "string", description: "Instagram-caption, 2-4 korte alinea's, zonder hashtags, eindigt met een CTA" },
    hashtags: { type: "array", items: { type: "string" }, maxItems: 10 },
    scene: { type: "string", description: "Engelse beschrijving van de foto voor de cover: setting, objecten, licht. Geen tekst in beeld." },
  },
  required: ["pillar", "template", "headline", "subline", "slides", "caption", "hashtags", "scene"],
};

const SYSTEM = `Je bent de contentstrateeg van SequenceFlow en schrijft Instagram-carrousels met tips voor drukke ondernemers.
Het doel is waarde geven, geen reclame. Elke post: een cover met kop (over een AI-foto), daarna 3-5 tipslides, en een caption.

${brandBrief()}

Mogelijke CTA's: ${VOICE.ctas.join(" | ")}
Standaard hashtags om uit te kiezen: ${VOICE.hashtags.join(" ")}`;

export function textProvider() {
  return kieConfigured() ? "kie" : "tipbank";
}

export async function generateDrafts(pillars: string[], existing: Post[]): Promise<PostDraft[]> {
  const avoid = existing.map((p) => p.headline);
  if (kieConfigured()) {
    try {
      const result = await kieStructured<{ posts: PostDraft[] }>({
        system: SYSTEM,
        toolName: "lever_posts",
        schema: { type: "object", properties: { posts: { type: "array", items: draftSchema } }, required: ["posts"] },
        prompt: [
          `Schrijf ${pillars.length} posts, in deze volgorde van pijlers: ${pillars.join(", ")}.`,
          "Wissel template af: meestal 'photo', soms 'card'. Elke post een ander onderwerp en een andere invalshoek.",
          avoid.length ? `Deze koppen bestaan al, kies andere onderwerpen:\n- ${avoid.slice(-120).join("\n- ")}` : "",
        ].join("\n\n"),
      });
      if (result.posts?.length) return pillars.map((pillar, i) => normalizeDraft(result.posts[i] ?? fallbackDraft(pillar, avoid), pillar));
    } catch (error) {
      console.error("[generator] kie.ai tekst mislukt, terugval op tipbank:", error);
    }
  }
  return pillars.map((pillar) => {
    const draft = fallbackDraft(pillar, avoid);
    avoid.push(draft.headline);
    return draft;
  });
}

export async function reviseDraft(post: Post, feedback: string): Promise<PostDraft | null> {
  if (!kieConfigured()) return null;
  try {
    const draft = await kieStructured<PostDraft>({
      system: SYSTEM,
      toolName: "lever_post",
      schema: draftSchema,
      prompt: `Verbeter deze post op basis van de feedback. Houd de pijler '${post.pillar}'.\n\nFeedback: ${feedback}\n\nHuidige post:\n${JSON.stringify({ headline: post.headline, subline: post.subline, slides: post.slides, caption: post.caption, scene: post.scene }, null, 2)}`,
    });
    return normalizeDraft(draft, post.pillar);
  } catch (error) {
    console.error("[generator] revisie mislukt:", error);
    return null;
  }
}

function normalizeDraft(draft: PostDraft, pillar: string): PostDraft {
  return {
    pillar,
    template: draft.template === "card" ? "card" : "photo",
    headline: String(draft.headline ?? "").trim(),
    subline: String(draft.subline ?? "").trim(),
    // de slide heeft al een nummercirkel, dus "1." of "Tip 1:" uit de titel halen
    slides: (draft.slides ?? []).slice(0, 5).map((s) => ({ title: String(s.title ?? "").replace(/^\s*(tip\s*)?\d+\s*[.):-]\s*/i, ""), body: String(s.body ?? "") })),
    caption: String(draft.caption ?? "").trim(),
    hashtags: (draft.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 10),
    scene: String(draft.scene ?? "").trim(),
  };
}

let bankCursor = 0;
function fallbackDraft(pillar: string, avoid: string[]): PostDraft {
  const pool = TIP_BANK.filter((t) => t.pillar === pillar);
  const fresh = pool.filter((t) => !avoid.includes(t.headline));
  const tip = fresh[0] ?? pool[bankCursor++ % Math.max(pool.length, 1)] ?? TIP_BANK[bankCursor++ % TIP_BANK.length];
  const cta = VOICE.ctas[(avoid.length + bankCursor) % VOICE.ctas.length];
  return {
    ...tip,
    pillar,
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
  const prompt = imagePromptFor(feedback ? `${post.scene}. Adjustments requested: ${feedback}` : post.scene);
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
          const kieTask = await createKieImage(post.image.prompt ?? imagePromptFor(post.scene));
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
    const known = new Set(pending.map((s) => s.date));
    const merged = [...pending, ...slots.filter((s) => !known.has(s.date))].sort((a, b) => a.date.localeCompare(b.date));
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

    const posts = await listPosts();
    const inFlight = posts.filter((p) => p.image.status === "generating").length;
    const room = Math.min(BATCH, MAX_IN_FLIGHT - inFlight);
    if (room <= 0) return queue;

    const taken = new Set(posts.map((p) => p.date));
    const free = queue.slots.filter((s) => !taken.has(s.date));
    const batch = free.slice(0, room);
    if (!batch.length) return await updateQueue((q) => (q ? { ...q, slots: [], status: "done" } : q));

    try {
      const drafts = await generateDrafts(assignPillars(batch.length, posts), posts);
      const now = new Date().toISOString();
      const created: Post[] = batch.map((slot, i) => ({
        id: crypto.randomUUID().slice(0, 8),
        ...slot,
        ...drafts[i],
        image: { status: "none", files: [], selected: 0 },
        status: "review",
        createdAt: now,
        updatedAt: now,
      }));
      await insertPosts(created);
      // één voor één starten: vriendelijk voor de rate limit (30/min)
      for (const post of created) await startImage(post);
      const doneDates = new Set(batch.map((s) => s.date));
      return await updateQueue((q) => {
        if (!q) return q;
        const slots = q.slots.filter((s) => !doneDates.has(s.date) && !taken.has(s.date));
        return { ...q, slots, done: q.done + created.length, lastError: undefined, pausedUntil: undefined, status: slots.length ? q.status : "done" };
      });
    } catch (error) {
      console.error("[queue] batch mislukt:", error);
      return await updateQueue((q) => (q ? { ...q, lastError: error instanceof Error ? error.message : String(error), pausedUntil: new Date(Date.now() + 30_000).toISOString() } : q));
    }
  } finally {
    queueBusy = false;
    await unlockQueue().catch(() => undefined);
  }
}
