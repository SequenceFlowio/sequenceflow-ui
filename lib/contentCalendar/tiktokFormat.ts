import type { Post, TikTokPostSettings } from "./types.ts";

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

/** Startwaarden: alles uit en geen zichtbaarheid gekozen (zo eist TikTok het). */
export const EMPTY_TIKTOK: TikTokPostSettings = { allowComment: false, allowDuet: false, allowStitch: false, disclose: false, yourBrand: false, brandedContent: false };

/** Controle zoals TikTok hem vraagt; geeft de melding (Engels, zoals in de richtlijnen) of null. */
export function validateTikTok(settings: TikTokPostSettings, privacyOptions: string[] = []) {
  if (!settings.privacyLevel) return "Choose who can view this post.";
  if (privacyOptions.length && !privacyOptions.includes(settings.privacyLevel)) return "This visibility option isn't available for this account.";
  if (settings.disclose && !settings.yourBrand && !settings.brandedContent) return "You need to indicate if your content promotes yourself, a third party, or both.";
  if (settings.brandedContent && settings.privacyLevel === "SELF_ONLY") return "Branded content visibility cannot be set to private.";
  return null;
}

/** Label dat TikTok bij de post zet, of null. */
export function tiktokContentLabel(settings: Pick<TikTokPostSettings, "disclose" | "yourBrand" | "brandedContent">) {
  if (!settings.disclose) return null;
  if (settings.brandedContent) return "Paid partnership";
  if (settings.yourBrand) return "Promotional content";
  return null;
}

/** Direct posten mag alleen met een bevestigde, geldige keuze; anders gaat de post naar de inbox. */
export function canPostDirect(post: Pick<Post, "tiktok">) {
  return Boolean(post.tiktok?.confirmedAt) && validateTikTok(post.tiktok!) === null;
}

/** post_info voor de Content Posting API op basis van de keuzes van de gebruiker. */
export function directPostInfo(settings: TikTokPostSettings, video: boolean) {
  return {
    privacy_level: settings.privacyLevel!,
    disable_comment: !settings.allowComment,
    ...(video ? { disable_duet: !settings.allowDuet, disable_stitch: !settings.allowStitch } : {}),
    brand_content_toggle: settings.disclose && settings.brandedContent,
    brand_organic_toggle: settings.disclose && settings.yourBrand,
  };
}

/** Alleen bekende velden, zodat de app geen rommel opslaat. */
export function sanitizeTikTok(input: unknown): TikTokPostSettings | undefined {
  if (!input || typeof input !== "object") return undefined;
  const v = input as Record<string, unknown>;
  const flag = (key: string) => v[key] === true;
  return {
    ...(typeof v.title === "string" ? { title: v.title.slice(0, 2200) } : {}),
    ...(typeof v.privacyLevel === "string" && v.privacyLevel ? { privacyLevel: v.privacyLevel } : {}),
    allowComment: flag("allowComment"),
    allowDuet: flag("allowDuet"),
    allowStitch: flag("allowStitch"),
    disclose: flag("disclose"),
    yourBrand: flag("disclose") && flag("yourBrand"),
    brandedContent: flag("disclose") && flag("brandedContent"),
    ...(typeof v.confirmedAt === "string" ? { confirmedAt: v.confirmedAt } : {}),
  };
}
