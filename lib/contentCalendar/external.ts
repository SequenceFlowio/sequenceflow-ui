import { localNow, type Locale } from "./locale.ts";
import type { Post } from "./types.ts";

export type IgMedia = { id: string; caption?: string; media_type?: string; media_product_type?: string; timestamp?: string; permalink?: string; thumbnail_url?: string; media_url?: string };

/** Instagram-post die niet via de kalender ging, als "gepost" item zodat hij meetelt in Prestaties. */
export function externalPost(media: IgMedia, locale: Locale): Post | null {
  if (!media.timestamp) return null;
  const [date, time] = localNow(locale, new Date(media.timestamp)).split(" ");
  const text = (media.caption ?? "").trim();
  const hashtags = [...new Set(text.match(/#[\p{L}\p{N}_]+/gu) ?? [])];
  const caption = text.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim();
  const firstLine = caption.split("\n").find((l) => l.trim())?.trim() ?? "";
  const reel = media.media_product_type === "REELS" || media.media_type === "VIDEO";
  const now = new Date().toISOString();
  return {
    id: `ig-${media.id}`,
    ...(locale === "en" ? { locale } : {}),
    kind: reel ? "reel" : "carousel",
    date,
    time,
    pillar: "extern",
    template: "photo",
    headline: firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine || (reel ? "Reel op Instagram" : "Post op Instagram"),
    subline: "",
    slides: [],
    caption,
    hashtags,
    scene: "",
    image: { status: "none", files: [], selected: 0 },
    status: "posted",
    publish: { instagram: { id: media.id, at: media.timestamp } },
    external: { source: "instagram", permalink: media.permalink, thumbnail: media.thumbnail_url ?? (reel ? undefined : media.media_url) },
    createdAt: now,
    updatedAt: now,
  };
}
