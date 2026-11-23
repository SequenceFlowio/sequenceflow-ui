import { signedMediaUrls } from "./db";
import { postIdFromVideoFile, signedDeleteRequest, signedMediaServerUrl } from "./mediaServerCore";
import type { PostVideo } from "./types";

/**
 * Video's op de Hetzner-server (zie mediaServerCore.ts). Pas aan als zowel
 * MEDIA_SERVER_URL als MEDIA_SIGNING_SECRET gezet zijn; anders blijft alles
 * in Supabase, zoals voorheen.
 */

const LINK_TTL = 60 * 60 * 24 * 2; // 2 dagen: lang genoeg voor Instagram-containers en de preview

function config() {
  const base = process.env.MEDIA_SERVER_URL?.trim();
  const secret = process.env.MEDIA_SIGNING_SECRET?.trim();
  return base && secret ? { base, secret } : null;
}

export function mediaServerConfigured() {
  return Boolean(config());
}

function serverUrl(file: string) {
  const cfg = config();
  if (!cfg) throw new Error("De mediaserver is niet ingesteld (MEDIA_SERVER_URL, MEDIA_SIGNING_SECRET)");
  return signedMediaServerUrl(cfg.base, cfg.secret, file, LINK_TTL);
}

/** Links naar video en cover van een reel, waar ze ook staan. De cover staat altijd in Supabase. */
export async function reelVideoLinks(video: PostVideo) {
  const supabase = await signedMediaUrls(video.store === "server" ? (video.cover ? [video.cover] : []) : [video.file, ...(video.cover ? [video.cover] : [])]);
  return {
    video: video.store === "server" ? serverUrl(video.file) : supabase[video.file],
    cover: video.cover ? supabase[video.cover] : undefined,
  };
}

/** Voor de preview: per bestandsnaam een link. Video's op de server herkennen we aan de post. */
export async function mediaLinks(files: string[], storeOf: (postId: string) => Promise<PostVideo["store"]>) {
  const onServer = new Set<string>();
  if (config()) {
    for (const file of files) {
      const id = postIdFromVideoFile(file);
      if (id && (await storeOf(id)) === "server") onServer.add(file);
    }
  }
  const links: Record<string, string> = await signedMediaUrls(files.filter((file) => !onServer.has(file)));
  for (const file of onServer) links[file] = serverUrl(file);
  return links;
}

/** De video zelf, voor TikTok (wij uploaden het bestand). */
export async function readServerVideo(file: string) {
  const response = await fetch(serverUrl(file), { cache: "no-store" });
  if (!response.ok) throw new Error(`Video ophalen van de mediaserver mislukt (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteServerVideos(files: string[]) {
  const cfg = config();
  if (!cfg || !files.length) return;
  const response = await fetch(`${cfg.base.replace(/\/$/, "")}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signedDeleteRequest(cfg.secret, files)),
  });
  if (!response.ok) throw new Error(`Video's verwijderen op de mediaserver mislukt (${response.status})`);
}
