import { renderToken } from "./access";
import { listPosts, updatePost } from "./db";
import { API_PATH } from "./paths";
import { amsterdamNow, isDue } from "./planning.ts";
import type { Post } from "./types";

/**
 * Publiceert goedgekeurde posts naar Instagram (carrousel) en de Facebook-pagina
 * zodra hun moment (Europe/Amsterdam) is aangebroken. Draait vanuit de cron.
 * Gebaseerd op de publisher van de Noctis Content Studio.
 *
 * Staat pas aan met CONTENT_AUTOPUBLISH=true en de Meta-gegevens, zodat er
 * niets live gaat voordat jullie dat willen.
 */
const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const MAX_PER_TICK = 2;
const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = 10 * 60 * 1000;

export function metaConfig() {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  const igUserId = process.env.META_IG_USER_ID;
  if (!token || (!pageId && !igUserId)) return null;
  return { token, pageId, igUserId };
}

export function publishingEnabled() {
  return process.env.CONTENT_AUTOPUBLISH === "true" && metaConfig() !== null;
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

/** JPEG-URL's van alle slides (Instagram accepteert geen PNG), met getekende token. */
async function slideUrls(post: Post) {
  const token = await renderToken(post.id);
  const total = post.slides.length + 2;
  return Array.from({ length: total }, (_, i) => `${publicOrigin()}${API_PATH}/render/${post.id}/${i}?format=jpg&t=${token}&v=${encodeURIComponent(post.updatedAt)}`);
}

function captionFor(post: Post) {
  return [post.caption.trim(), post.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

async function publishInstagram(post: Post, urls: string[], cfg: NonNullable<ReturnType<typeof metaConfig>>) {
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

async function publishFacebook(post: Post, urls: string[], cfg: NonNullable<ReturnType<typeof metaConfig>>) {
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
  const cfg = metaConfig();
  if (!cfg) throw new Error("Meta is nog niet gekoppeld (META_ACCESS_TOKEN + META_IG_USER_ID / META_PAGE_ID)");
  const publish = { ...(post.publish ?? {}), attempts: (post.publish?.attempts ?? 0) + 1, lastAttemptAt: new Date().toISOString(), error: undefined as string | undefined };
  // Claim: zo pakt een tweede cron-run deze post niet tegelijk op
  await updatePost(post.id, { publish });
  const urls = await slideUrls(post);
  const errors: string[] = [];

  if (cfg.igUserId && !publish.instagram) {
    try {
      publish.instagram = { id: await publishInstagram(post, urls, cfg), at: new Date().toISOString() };
      await updatePost(post.id, { publish });
    } catch (error) {
      errors.push(`Instagram: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (cfg.pageId && !publish.facebook) {
    try {
      publish.facebook = { id: await publishFacebook(post, urls, cfg), at: new Date().toISOString() };
      await updatePost(post.id, { publish });
    } catch (error) {
      errors.push(`Facebook: ${error instanceof Error ? error.message : error}`);
    }
  }

  const done = (!cfg.igUserId || publish.instagram) && (!cfg.pageId || publish.facebook);
  return await updatePost(post.id, { publish: { ...publish, error: errors.join(" · ") || undefined }, ...(done ? { status: "posted" as const } : {}) });
}

/** Cron: goedgekeurde posts waarvan datum + tijd voorbij is. */
export async function publishDuePosts() {
  if (!publishingEnabled()) return { enabled: false, published: 0 };
  const now = amsterdamNow();
  const due = (await listPosts()).filter((post) => isDue(post, now, { maxAttempts: MAX_ATTEMPTS, retryAfterMs: RETRY_AFTER_MS })).slice(0, MAX_PER_TICK);
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
