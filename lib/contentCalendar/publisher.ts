import { renderToken } from "./access";
import { GRAPH_BASE, metaConfig } from "./meta";
import { listPosts, signedMediaUrls, updatePost } from "./db";
import { TIKTOK_MEDIA_ORIGIN, publishTikTokPhotos, publishTikTokVideo, tiktokConnected, tiktokPublishStatus } from "./tiktok";
import { API_PATH } from "./paths";
import { amsterdamNow, isDue, shouldAutoApprove } from "./planning.ts";
import type { Post, PostPublish } from "./types";

/**
 * Publiceert goedgekeurde posts naar Instagram (carrousel of reel) en de Facebook-pagina
 * zodra hun moment (Europe/Amsterdam) is aangebroken. Draait vanuit de cron.
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

export async function publishingEnabled() {
  return process.env.CONTENT_AUTOPUBLISH === "true" && (await metaConfig()) !== null;
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

function captionFor(post: Post) {
  return [post.caption.trim(), post.hashtags.join(" ")].filter(Boolean).join("\n\n");
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

/** Links (1 dag geldig) naar video en cover van een reel. */
async function reelUrls(post: Post) {
  if (!post.video?.file) throw new Error("Reel heeft geen video");
  const files = [post.video.file, ...(post.video.cover ? [post.video.cover] : [])];
  const urls = await signedMediaUrls(files);
  const video = urls[post.video.file];
  if (!video) throw new Error("Geen link naar de video");
  return { video, cover: post.video.cover ? urls[post.video.cover] : undefined };
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
async function publishInstagramReel(post: Post, publish: PostPublish, cfg: MetaConfig, story = false) {
  let containerId = publish.instagramContainer && Date.now() - new Date(publish.instagramContainer.at).getTime() < 20 * 60 * 60 * 1000 ? publish.instagramContainer.id : undefined;
  if (!containerId) {
    const { video, cover } = await reelUrls(post);
    const container = await graphPost(`${cfg.igUserId}/media`, story
      ? { media_type: "STORIES", video_url: video, access_token: cfg.token }
      : { media_type: "REELS", video_url: video, ...(cover ? { cover_url: cover } : {}), caption: captionFor(post), share_to_feed: "true", access_token: cfg.token });
    if (!container.id) throw new Error("Instagram gaf geen reel-container terug");
    containerId = container.id;
    publish.instagramContainer = { id: containerId, at: new Date().toISOString() };
    await updatePost(post.id, { publish });
  }
  for (let attempt = 0; attempt < 24; attempt++) {
    const status = await containerStatus(containerId, cfg.token);
    if (status.status_code === "FINISHED") {
      const published = await graphPost(`${cfg.igUserId}/media_publish`, { creation_id: containerId, access_token: cfg.token });
      return published.id ?? containerId;
    }
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      publish.instagramContainer = undefined;
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
  const cfg = await metaConfig();
  if (!cfg) throw new Error("Instagram en Facebook zijn nog niet gekoppeld");
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

  // TikTok: carrousels als fotopost, reels als video; stories bestaan daar niet via de API
  const tiktok = !story && (await tiktokConnected());
  if (tiktok && (!publish.tiktok || publish.tiktok.status === "failed")) {
    try {
      const id = reel ? await publishTikTokVideo(post) : await publishTikTokPhotos(post, await slideUrls(post, TIKTOK_MEDIA_ORIGIN));
      publish.tiktok = { id, at: new Date().toISOString(), status: "processing" };
      await updatePost(post.id, { publish });
    } catch (error) {
      errors.push(`TikTok: ${error instanceof Error ? error.message : error}`);
    }
  }

  const done = (!cfg.igUserId || publish.instagram) && (!cfg.pageId || story || publish.facebook) && (!tiktok || (publish.tiktok && publish.tiktok.status !== "failed"));
  return await updatePost(post.id, { publish: { ...publish, error: errors.join(" · ") || undefined }, ...(done ? { status: "posted" as const } : {}) });
}

/**
 * Cron: stand van TikTok-posts bijwerken (verwerken → in de inbox / gepubliceerd / mislukt).
 * Mislukt: de post gaat terug naar "goedgekeurd", zodat de volgende ronde TikTok opnieuw probeert.
 */
export async function syncTikTokStatuses(posts?: Post[]) {
  const all = posts ?? (await listPosts());
  const pending = all.filter((p) => p.publish?.tiktok?.status === "processing" && Date.now() - new Date(p.publish.tiktok.at).getTime() < 48 * 3_600_000).slice(0, 5);
  let updated = 0;
  for (const post of pending) {
    try {
      const result = await tiktokPublishStatus(post.publish!.tiktok!.id);
      if (result.status === "processing") continue;
      const tiktok = { ...post.publish!.tiktok!, status: result.status, ...(result.error ? { error: result.error } : {}) };
      const failed = result.status === "failed";
      const attempts = post.publish?.attempts ?? 0;
      await updatePost(post.id, {
        publish: { ...post.publish, tiktok, ...(failed ? { error: `TikTok: ${result.error}` } : {}) },
        ...(failed && attempts < MAX_ATTEMPTS ? { status: "approved" as const } : {}),
      });
      updated++;
    } catch (error) {
      console.error(`[tiktok] status ${post.id} ophalen mislukt`, error);
    }
  }
  return { updated };
}

/** Cron: goedgekeurde posts waarvan datum + tijd voorbij is. */
export async function publishDuePosts() {
  if (!(await publishingEnabled())) return { enabled: false, published: 0 };
  const now = amsterdamNow();
  const posts = await listPosts();
  // Automatisch goedkeuren: een carrousel die nog op "beoordelen" staat gaat op zijn moment
  // alsnog live, mits de foto klaar is. Afwijzen vóór dat moment houdt hem tegen.
  if (autoApproveEnabled()) {
    for (const post of posts) {
      if (shouldAutoApprove(post, now)) {
        const approved = await updatePost(post.id, { status: "approved" });
        Object.assign(post, approved);
      }
    }
  }
  const due = posts.filter((post) => isDue(post, now, { maxAttempts: MAX_ATTEMPTS, retryAfterMs: RETRY_AFTER_MS })).slice(0, MAX_PER_TICK);
  let published = 0;
  for (const post of due) {
    try {
      const result = await publishPost(post);
      if (result.status === "posted") published++;
    } catch (error) {
      console.error(`[contentcalender] publiceren ${post.id} mislukt:`, error);
    }
  }
  return { enabled: true, published };
}
