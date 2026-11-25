import type { Post } from "./types.ts";
import type { Locale } from "./locale.ts";
import { tiktokText } from "./tiktokFormat.ts";

/**
 * TikTok via Zernio (tijdelijk, tot onze eigen TikTok-app door de audit is): Zernio is wél
 * goedgekeurd, dus posts gaan meteen openbaar live. Los van API en database zodat het te testen is.
 */

export const ZERNIO_ID_PREFIX = "zernio:";

/** Welk TikTok-account bij welke taal hoort (gebruikersnaam zoals in Zernio, zonder @). */
export function zernioUsername(locale: Locale, env: Record<string, string | undefined> = process.env) {
  return (locale === "en" ? env.ZERNIO_TIKTOK_EN || "sequenceflow.io" : env.ZERNIO_TIKTOK_NL || "sequenceflownl").replace(/^@/, "").toLowerCase();
}

export type ZernioAccount = { _id: string; platform: string; username?: string; isActive?: boolean };

export function pickZernioAccount(accounts: ZernioAccount[], username: string) {
  return accounts.find((a) => a.platform === "tiktok" && (a.username ?? "").replace(/^@/, "").toLowerCase() === username && a.isActive !== false) ?? null;
}

export type ZernioMedia = { video: string } | { images: string[] };

/** Body voor POST /v1/posts: meteen openbaar publiceren op één TikTok-account. */
export function zernioPostBody(post: Pick<Post, "headline" | "caption" | "tiktok">, accountId: string, media: ZernioMedia) {
  const text = tiktokText(post);
  const base = { privacy_level: "PUBLIC_TO_EVERYONE", allow_comment: true, content_preview_confirmed: true, express_consent_given: true };
  if ("video" in media) {
    return {
      content: (post.tiktok?.title || text.videoTitle).slice(0, 2200),
      mediaItems: [{ type: "video", url: media.video }],
      platforms: [{ platform: "tiktok", accountId }],
      tiktokSettings: { ...base, allow_duet: true, allow_stitch: true },
      publishNow: true,
    };
  }
  return {
    content: text.photoTitle,
    mediaItems: media.images.slice(0, 35).map((url) => ({ type: "image", url })),
    platforms: [{ platform: "tiktok", accountId }],
    tiktokSettings: { ...base, media_type: "photo", photo_cover_index: 0, description: text.photoDescription, auto_add_music: true },
    publishNow: true,
  };
}

type ZernioEntry = { platform?: string; status?: string; error?: string; errorMessage?: string };
export type ZernioPost = { _id?: string; status?: string; platforms?: ZernioEntry[]; platformResults?: ZernioEntry[]; error?: string };

/** Stand van een Zernio-post vertaald naar onze TikTok-stand. */
export function zernioTikTokStatus(post: ZernioPost): { status: "processing" | "published" | "failed"; error?: string } {
  const entry = [...(post.platformResults ?? []), ...(post.platforms ?? [])].find((p) => p.platform === "tiktok" && p.status);
  const status = entry?.status ?? post.status;
  if (status === "published") return { status: "published" };
  if (status === "failed" || status === "cancelled" || (!entry && post.status === "partial")) {
    return { status: "failed", error: entry?.errorMessage || entry?.error || post.error || "Zernio kon de TikTok-post niet plaatsen" };
  }
  return { status: "processing" };
}
