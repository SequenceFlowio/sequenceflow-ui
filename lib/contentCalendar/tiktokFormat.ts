import type { Post } from "./types.ts";

/** Regels van TikTok voor tekst en uploads, los van API en database zodat ze te testen zijn. */

/** Tekst voor TikTok: titel max 90 tekens (foto) of 2200 (video, incl. hashtags). */
export function tiktokText(post: Pick<Post, "headline" | "caption" | "hashtags">) {
  const hashtags = post.hashtags.join(" ");
  const full = [post.caption.trim(), hashtags].filter(Boolean).join("\n\n");
  return {
    photoTitle: post.headline.length > 90 ? `${post.headline.slice(0, 89)}…` : post.headline,
    photoDescription: full.slice(0, 4000),
    videoTitle: full.length > 2200 ? `${full.slice(0, 2200 - hashtags.length - 3)}…\n\n${hashtags}`.slice(0, 2200) : full,
  };
}

/** Chunks volgens TikTok: <5 MB of ≤64 MB in één keer; groter in stukken van 10 MB (de laatste neemt de rest). */
export function chunkPlan(size: number) {
  if (size <= 64 * 1024 * 1024) return { chunkSize: size, count: 1 };
  const chunkSize = 10 * 1024 * 1024;
  return { chunkSize, count: Math.floor(size / chunkSize) };
}
