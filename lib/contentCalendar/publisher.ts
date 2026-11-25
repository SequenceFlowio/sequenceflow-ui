import { renderToken } from "./access";
import { GRAPH_BASE, metaConfig } from "./meta";
import { getPost, listPosts, updatePost } from "./db";
import { TIKTOK_MEDIA_ORIGIN, publishTikTokPhotos, publishTikTokVideo, tiktokConnected, tiktokPublishStatus } from "./tiktok";
import { reelVideoLinks } from "./mediaServer";
import { publishViaZernio, zernioConfigured, zernioPublishStatus } from "./zernio";
import { ZERNIO_ID_PREFIX } from "./zernioFormat.ts";
import { withAcademyCta } from "./academyCta.ts";
import { API_PATH } from "./paths";
import { hasMedia, isDue, shouldAutoApprove, wantsReelStory } from "./planning.ts";
import { LOCALES, localNow, localeOf, type Locale } from "./locale.ts";
import type { Post, PostPublish } from "./types";

/**
 * Publiceert goedgekeurde posts naar Instagram (carrousel of reel) en de Facebook-pagina
 * zodra hun moment is aangebroken, in de tijdzone van hun taal (Amsterdam of New York),
 * naar de accounts van die taal. Draait vanuit de cron.
 * Gebaseerd op de publisher van de Noctis Content Studio.
 *
 * Staat pas aan met CONTENT_AUTOPUBLISH=true en de Meta-gegevens, zodat er
 * niets live gaat voordat jullie dat willen.
 */
const MAX_PER_TICK = 2;
const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = 10 * 60 * 1000;

type MetaConfig = NonNullable<Awaited<ReturnType<typeof metaConfig>>>;

/** Standaard aan; CONTENT_AUTO_APPROVE=false zet het uit (dan alleen handmatig goedgekeurde posts). */
export function autoApproveEnabled() {
  return process.env.CONTENT_AUTO_APPROVE !== "false";
}

export async function publishingEnabled(locale: Locale = "nl") {
  return process.env.CONTENT_AUTOPUBLISH === "true" && (await metaConfig(locale)) !== null;
}

function publicOrigin() {
  return (process.env.CONTENT_PUBLIC_ORIGIN || "https://sequenceflow.io").replace(/\/$/, "");
}

async function graphPost(path: string, params: Record<string, string>) {
  const response = await fetch(`${GRAPH_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error?.message ?? `Meta request mislukt (${response.status})`);
  return data as { id?: string };
}

/** JPEG-URL's van alle slides (Instagram en TikTok accepteren geen PNG), met getekende token. */
async function slideUrls(post: Post, origin = publicOrigin()) {
  const token = await renderToken(post.id);
  const total = post.slides.length + 2;
  return Array.from({ length: total }, (_, i) => `${origin}${API_PATH}/render/${post.id}/${i}?format=jpg&t=${token}&v=${encodeURIComponent(post.updatedAt)}`);
}

// geen hashtags meer: ze helpen niet voor bereik en ogen als reclame (sinds 21 nov 2026)
// slot is altijd de Academy-oproep (comment VIDEO → DM met de link); stories hebben geen caption in beeld
function captionFor(post: Post) {
  return post.kind === "story" ? post.caption.trim() : withAcademyCta(post.caption, localeOf(post));
}

async function publishInstagram(post: Post, urls: string[], cfg: MetaConfig) {
  const children: string[] = [];
  for (const url of urls.slice(0, 10)) {
    const child = await graphPost(`${cfg.igUserId}/media`, { image_url: url, is_carousel_item: "true", access_token: cfg.token });
    if (!child.id) throw new Error("Instagram gaf geen slide-container terug");
    children.push(child.id);
  }
  const container = await graphPost(`${cfg.igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: captionFor(post), access_token: cfg.token });
  if (!container.id) throw new Error("Instagram gaf geen container-ID terug");
  // Wachten tot Instagram de carrousel verwerkt heeft
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await fetch(`${GRAPH_BASE}/${container.id}?fields=status_code&access_token=${encodeURIComponent(cfg.token)}`, { cache: "no-store" });
    const status = await response.json().catch(() => ({}));
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error("Instagram kon de slides niet verwerken");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  const published = await graphPost(`${cfg.igUserId}/media_publish`, { creation_id: container.id, access_token: cfg.token });
  return published.id ?? container.id;
}

/** Tijdelijke links naar video en cover van een reel (video op de Hetzner-server of in de bucket). */
async function reelUrls(post: Post) {
  if (!post.video?.file) throw new Error("Reel heeft geen video");
  const { video, cover } = await reelVideoLinks(post.video);
  if (!video) throw new Error("Geen link naar de video");
  return { video, cover };
}

async function containerStatus(id: string, token: string) {
  const response = await fetch(`${GRAPH_BASE}/${id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
  return (await response.json().catch(() => ({}))) as { status_code?: string; status?: string };
}

/**
 * Reel naar Instagram (ook zichtbaar in de feed). Video's verwerken langer dan foto's:
 * lukt het niet binnen ~2 minuten, dan bewaren we de container en publiceert de
 * volgende poging hem (containers blijven 24 uur geldig).
 */
async function publishInstagramReel(post: Post, publish: PostPublish, cfg: MetaConfig, story = false, key: "instagramContainer" | "instagramStoryContainer" = "instagramContainer") {
  const saved = publish[key];
  let containerId = saved && Date.now() - new Date(saved.at).getTime() < 20 * 60 * 60 * 1000 ? saved.id : undefined;
  if (!containerId) {
    const { video, cover } = await reelUrls(post);
    const container = await graphPost(`${cfg.igUserId}/media`, story
      ? { media_type: "STORIES", video_url: video, access_token: cfg.token }
      : { media_type: "REELS", video_url: video, ...(cover ? { cover_url: cover } : {}), caption: captionFor(post), share_to_feed: "true", access_token: cfg.token });
    if (!container.id) throw new Error("Instagram gaf geen reel-container terug");
    containerId = container.id;
    publish[key] = { id: containerId, at: new Date().toISOString() };
    await updatePost(post.id, { publish });
  }
  for (let attempt = 0; attempt < 24; attempt++) {
    const status = await containerStatus(containerId, cfg.token);
    if (status.status_code === "FINISHED") {
      const published = await graphPost(`${cfg.igUserId}/media_publish`, { creation_id: containerId, access_token: cfg.token });
      return published.id ?? containerId;
    }
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      publish[key] = undefined;
      throw new Error(`Instagram kon de video niet verwerken${status.status ? `: ${status.status}` : ""}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Instagram verwerkt de video nog; volgende poging publiceert hem");
}

async function publishFacebookReel(post: Post, cfg: MetaConfig) {
  const { video } = await reelUrls(post);
  const result = await graphPost(`${cfg.pageId}/videos`, { file_url: video, description: captionFor(post), access_token: cfg.token });
  return result.id ?? "onbekend";
}

async function publishFacebook(post: Post, urls: string[], cfg: MetaConfig) {
  // Eerst alle foto's onzichtbaar uploaden, dan één feedpost met alle bijlagen
  const photoIds: string[] = [];
  for (const url of urls) {
    const photo = await graphPost(`${cfg.pageId}/photos`, { url, published: "false", access_token: cfg.token });
    if (!photo.id) throw new Error("Facebook gaf geen foto-ID terug");
    photoIds.push(photo.id);
  }
  const params: Record<string, string> = { message: captionFor(post), access_token: cfg.token };
  photoIds.forEach((id, index) => { params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id }); });
  const result = await graphPost(`${cfg.pageId}/feed`, params);
  return result.id ?? "onbekend";
}

/** Publiceert één post naar alle gekoppelde kanalen; slaat kanalen over die al gelukt zijn. */
export async function publishPost(post: Post) {
  const locale = localeOf(post);
  const cfg = await metaConfig(locale);
  if (!cfg) throw new Error(locale === "en" ? "Het Engelse Instagram-account is nog niet gekoppeld" : "Instagram en Facebook zijn nog niet gekoppeld");
  const publish = { ...(post.publish ?? {}), attempts: (post.publish?.attempts ?? 0) + 1, lastAttemptAt: new Date().toISOString(), error: undefined as string | undefined };
  // Claim: zo pakt een tweede cron-run deze post niet tegelijk op
  await updatePost(post.id, { publish });
  const story = post.kind === "story";
  const reel = post.kind === "reel" || story;
  const urls = reel ? [] : await slideUrls(post);
  const errors: string[] = [];

  if (cfg.igUserId && !publish.instagram) {
    try {
      publish.instagram = { id: reel ? await publishInstagramReel(post, publish, cfg, story) : await publishInstagram(post, urls, cfg), at: new Date().toISOString() };
      publish.instagramContainer = undefined;
      await updatePost(post.id, { publish });
    } catch (error) {
      errors.push(`Instagram: ${error instanceof Error ? error.message : error}`);
    }
  }
  // Stories gaan alleen naar Instagram
  if (cfg.pageId && !publish.facebook && !story) {
    try {
      publish.facebook = { id: reel ? await publishFacebookReel(post, cfg) : await publishFacebook(post, urls, cfg), at: new Date().toISOString() };
      await updatePost(post.id, { publish });
    } catch (error) {
      errors.push(`Facebook: ${error instanceof Error ? error.message : error}`);
    }
  }

  // TikTok: carrousels als fotopost, reels als video; stories bestaan daar niet via de API.
  // Een TikTok-fout houdt de post niet tegen: Instagram en Facebook tellen, TikTok probeert retryTikTok later opnieuw.
  if (!story && !publish.tiktok && (await tiktokReady(locale))) {
    publish.tiktok = await sendToTikTok(post);
    await updatePost(post.id, { publish });
  }

  const done = (!cfg.igUserId || publish.instagram) && (!cfg.pageId || story || publish.facebook);
  return await updatePost(post.id, { publish: { ...publish, error: errors.join(" · ") || undefined }, ...(done ? { status: "posted" as const } : {}) });
}

/** TikTok kan via Zernio (zolang ZERNIO_API_KEY gezet is) of via onze eigen gekoppelde app. */
async function tiktokReady(locale: Locale) {
  return zernioConfigured() || (await tiktokConnected(locale));
}

/** Eén poging naar TikTok; geeft de nieuwe TikTok-stand terug (ook bij een fout). */
async function sendToTikTok(post: Post, previous?: PostPublish["tiktok"]): Promise<NonNullable<PostPublish["tiktok"]>> {
  const attempts = (previous?.attempts ?? 0) + 1;
  const at = new Date().toISOString();
  try {
    const reel = post.kind === "reel";
    if (zernioConfigured()) {
      if (reel && !post.video?.file) throw new Error("Reel heeft geen video");
      const media = reel ? { video: (await reelVideoLinks(post.video!)).video } : { images: await slideUrls(post, TIKTOK_MEDIA_ORIGIN) };
      const result = await publishViaZernio(post, media);
      return { id: result.id, at, status: result.status, ...(result.error ? { error: result.error } : {}), attempts };
    }
    const id = reel ? await publishTikTokVideo(post) : await publishTikTokPhotos(post, await slideUrls(post, TIKTOK_MEDIA_ORIGIN));
    return { id, at, status: "processing", attempts };
  } catch (error) {
    return { id: previous?.id ?? "", at, status: "failed", error: error instanceof Error ? error.message : String(error), attempts };
  }
}

/** Reel als Instagram-story: dezelfde video, geen caption (die toont een story niet). */
async function sendReelStory(post: Post) {
  const cfg = await metaConfig(localeOf(post));
  if (!cfg?.igUserId) throw new Error("Instagram is niet gekoppeld");
  const publish: PostPublish = { ...(post.publish ?? {}) };
  try {
    publish.instagramStory = { id: await publishInstagramReel(post, publish, cfg, true, "instagramStoryContainer"), at: new Date().toISOString() };
    publish.instagramStoryContainer = undefined;
    publish.storyError = undefined;
  } catch (error) {
    publish.storyError = error instanceof Error ? error.message : String(error);
    publish.storyAttempts = (publish.storyAttempts ?? 0) + 1;
  }
  return await updatePost(post.id, (current) => ({ publish: { ...current.publish, instagramStory: publish.instagramStory, instagramStoryContainer: publish.instagramStoryContainer, storyError: publish.storyError, storyAttempts: publish.storyAttempts } }));
}

/**
 * Cron: elke reel die net op Instagram staat ook als story plaatsen (één per ronde, video's verwerken traag).
 * Reels met een eigen story-post (id + "-story") slaan we over, zodat er geen dubbele story komt.
 */
export async function publishReelStories(posts?: Post[]) {
  if (process.env.CONTENT_AUTOPUBLISH !== "true") return { posted: 0 };
  const all = posts ?? (await listPosts());
  const ids = new Set(all.map((p) => p.id));
  const next = all.filter((p) => wantsReelStory(p) && !ids.has(`${p.id}-story`)).sort((a, b) => (a.publish!.instagram!.at < b.publish!.instagram!.at ? -1 : 1))[0];
  if (!next) return { posted: 0 };
  const fresh = await getPost(next.id);
  if (!fresh || !wantsReelStory(fresh)) return { posted: 0 };
  const done = await sendReelStory(fresh);
  return { posted: done?.publish?.instagramStory ? 1 : 0, id: next.id, error: done?.publish?.storyError };
}

/** Handmatig (of ingepland vanaf de server): een geplaatste reel nu als story plaatsen, ook een oudere. */
export async function publishReelStoryNow(post: Post) {
  if (post.kind !== "reel" || post.status !== "posted" || !post.video?.file) throw new Error("Alleen een geplaatste reel met video kan als story");
  if (post.publish?.instagramStory) throw new Error("Deze reel staat al als story");
  const done = await sendReelStory(post);
  if (!done?.publish?.instagramStory) throw new Error(done?.publish?.storyError || "Story plaatsen mislukt");
  return done;
}

const TIKTOK_MAX_ATTEMPTS = 4;

/**
 * Cron: mislukte TikTok-pogingen van gepubliceerde posts opnieuw proberen. Staan er te veel
 * concepten in je TikTok-inbox (spam_risk_too_many_pending_share), dan wachten we langer:
 * TikTok laat pas weer toe als je er een paar hebt geplaatst of verwijderd.
 */
export async function retryTikTok(posts?: Post[]) {
  const all = posts ?? (await listPosts());
  const now = Date.now();
  const failed = all.filter((p) => {
    const t = p.publish?.tiktok;
    if (p.status !== "posted" || p.kind === "story" || t?.status !== "failed" || (t.attempts ?? 1) >= TIKTOK_MAX_ATTEMPTS) return false;
    const wait = /pending_share|spam_risk/.test(t.error ?? "") ? 3 * 3_600_000 : 30 * 60_000;
    return now - new Date(t.at).getTime() > wait && now - new Date(p.publish?.instagram?.at ?? t.at).getTime() < 72 * 3_600_000;
  }).slice(0, 2);
  let retried = 0;
  for (const post of failed) {
    if (!(await tiktokReady(localeOf(post)))) continue;
    const tiktok = await sendToTikTok(post, post.publish!.tiktok);
    await updatePost(post.id, (current) => ({ publish: { ...current.publish, tiktok } }));
    retried++;
  }
  return { retried };
}

/**
 * Handmatig: een mislukte TikTok-poging van een geplaatste post meteen opnieuw versturen.
 * Met Zernio mag ook een post die als concept in de TikTok-inbox bleef hangen of nog nooit naar TikTok ging
 * (bijvoorbeeld van vóór de koppeling van het Engelse account): die gaat dan alsnog openbaar.
 */
export async function retryTikTokNow(post: Post) {
  const status = post.publish?.tiktok?.status;
  const allowed = status === "failed" || ((status === "inbox" || !status) && zernioConfigured());
  if (post.status !== "posted" || !allowed) throw new Error("Alleen een mislukte TikTok-poging (of met Zernio een inbox-concept) van een geplaatste post kan opnieuw");
  if (!(await tiktokReady(localeOf(post)))) throw new Error("TikTok is niet gekoppeld");
  const tiktok = await sendToTikTok(post, post.publish?.tiktok);
  return await updatePost(post.id, (current) => ({ publish: { ...current.publish, tiktok } }));
}

/**
 * Cron: stand van TikTok-posts bijwerken (verwerken → in de inbox / gepubliceerd / mislukt).
 * Mislukt: retryTikTok probeert het later opnieuw; de post zelf blijft gepubliceerd.
 */
export async function syncTikTokStatuses(posts?: Post[]) {
  const all = posts ?? (await listPosts());
  const pending = all.filter((p) => p.publish?.tiktok?.status === "processing" && Date.now() - new Date(p.publish.tiktok.at).getTime() < 48 * 3_600_000).slice(0, 5);
  let updated = 0;
  const stillProcessing: string[] = [];
  const errors: string[] = [];
  for (const post of pending) {
    try {
      const id = post.publish!.tiktok!.id;
      const result = id.startsWith(ZERNIO_ID_PREFIX) ? { ...(await zernioPublishStatus(id)), raw: "zernio" } : await tiktokPublishStatus(id, localeOf(post));
      if (result.status === "processing") { stillProcessing.push(`${post.id}: ${result.raw ?? "?"}`); continue; }
      const tiktok = { ...post.publish!.tiktok!, status: result.status, ...(result.error ? { error: result.error } : {}) };
      await updatePost(post.id, (current) => ({ publish: { ...current.publish, tiktok } }));
      updated++;
    } catch (error) {
      console.error(`[tiktok] status ${post.id} ophalen mislukt`, error);
      errors.push(`${post.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { updated, stillProcessing, errors };
}

/** Cron: goedgekeurde posts waarvan datum + tijd voorbij is. */
export async function publishDuePosts() {
  const enabled = new Set<Locale>();
  for (const locale of LOCALES) if (await publishingEnabled(locale)) enabled.add(locale);
  if (!enabled.size) return { enabled: false, published: 0 };
  // elke taal publiceert op de klok van zijn eigen tijdzone
  const nowFor = Object.fromEntries(LOCALES.map((l) => [l, localNow(l)])) as Record<Locale, string>;
  const posts = (await listPosts()).filter((p) => enabled.has(localeOf(p)));
  // Automatisch goedkeuren: een carrousel die nog op "beoordelen" staat gaat op zijn moment
  // alsnog live, mits de foto klaar is. Afwijzen vóór dat moment houdt hem tegen.
  if (autoApproveEnabled()) {
    for (const post of posts) {
      if (shouldAutoApprove(post, nowFor[localeOf(post)])) {
        const approved = await updatePost(post.id, { status: "approved" });
        Object.assign(post, approved);
      }
    }
  }
  const due = posts.filter((post) => hasMedia(post) && isDue(post, nowFor[localeOf(post)], { maxAttempts: MAX_ATTEMPTS, retryAfterMs: RETRY_AFTER_MS })).slice(0, MAX_PER_TICK);
  let published = 0;
  for (const post of due) {
    try {
      const result = await publishPost(post);
      if (result.status === "posted") published++;
    } catch (error) {
      console.error(`[contentcalender] publiceren ${post.id} mislukt:`, error);
    }
  }
  return { enabled: [...enabled], published };
}
