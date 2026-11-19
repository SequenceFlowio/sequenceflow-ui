import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { readMedia } from "./db";
import { seal, unseal } from "./metaCrypto.ts";
import type { Post } from "./types";
import { localeOf, type Locale } from "./locale.ts";
import { chunkPlan, tiktokText } from "./tiktokFormat.ts";

export { chunkPlan, tiktokText } from "./tiktokFormat.ts";

/**
 * TikTok via de Content Posting API van de eigen SequenceFlow-app.
 * Carrousels gaan als fotopost (TikTok haalt de slides op via onze geverifieerde URL),
 * reels als video (wij uploaden het bestand, zodat TikTok niets uit de opslag hoeft te halen).
 *
 * Twee modi:
 * - inbox (standaard): de post komt als concept in de TikTok-app; jij plaatst hem (en kunt een geluid kiezen).
 * - direct: meteen gepubliceerd. Tot de audit van TikTok alleen privé (SELF_ONLY).
 *
 * De koppeling staat versleuteld in content_queue onder id "tiktok-connection" (Nederlands)
 * en "tiktok-connection-en" (Engels): elke taal heeft een eigen TikTok-account.
 */
const API = "https://open.tiktokapis.com/v2";
const connectionId = (locale: Locale) => (locale === "en" ? "tiktok-connection-en" : "tiktok-connection");
export const TIKTOK_SCOPES = ["user.info.basic", "video.upload", "video.publish"] as const;

/** TikTok mag alleen van een geverifieerd adres ophalen; de apex sequenceflow.io stuurt door, dus altijd www. */
export const TIKTOK_MEDIA_ORIGIN = (process.env.TIKTOK_MEDIA_ORIGIN || "https://www.sequenceflow.io").replace(/\/$/, "");

export function tiktokAppConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  return clientKey && clientSecret ? { clientKey, clientSecret } : null;
}

export interface TikTokSettings {
  mode: "inbox" | "direct";
  privacyLevel?: string; // verplicht bij direct; opties komen van creator_info
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  autoAddMusic: boolean; // fotoposts: TikTok kiest zelf een passend geluid
}

const DEFAULT_SETTINGS: TikTokSettings = { mode: "inbox", allowComment: true, allowDuet: true, allowStitch: true, autoAddMusic: true };

interface StoredConnection {
  openId: string;
  displayName: string;
  avatarUrl?: string;
  accessToken: string; // versleuteld
  accessExpiresAt: string;
  refreshToken: string; // versleuteld
  refreshExpiresAt: string;
  scope: string;
  settings: TikTokSettings;
  privacyOptions?: string[];
  connectedAt: string;
}

async function readConnection(locale: Locale): Promise<StoredConnection | null> {
  const { data } = await getSupabaseAdmin().from("content_queue").select("data").eq("id", connectionId(locale)).maybeSingle();
  return (data?.data as StoredConnection | null) ?? null;
}

async function writeConnection(locale: Locale, connection: StoredConnection | null) {
  const db = getSupabaseAdmin().from("content_queue");
  const { error } = connection
    ? await db.upsert({ id: connectionId(locale), data: connection, updated_at: new Date().toISOString() })
    : await db.delete().eq("id", connectionId(locale));
  if (error) throw new Error(error.message);
}

export async function tiktokSummary(locale: Locale = "nl") {
  const c = await readConnection(locale).catch(() => null);
  if (!c) return null;
  return { displayName: c.displayName, avatarUrl: c.avatarUrl ?? null, connectedAt: c.connectedAt, settings: c.settings, privacyOptions: c.privacyOptions ?? [], scope: c.scope };
}

/* ---------- OAuth ---------- */

export function tiktokAuthorizeUrl(redirectUri: string, state: string) {
  const app = tiktokAppConfig();
  if (!app) throw new Error("TIKTOK_CLIENT_KEY en TIKTOK_CLIENT_SECRET ontbreken");
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", app.clientKey);
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token: string; refresh_expires_in: number; open_id: string; scope: string; error?: string; error_description?: string };

async function tokenRequest(params: Record<string, string>) {
  const app = tiktokAppConfig();
  if (!app) throw new Error("TikTok-app niet geconfigureerd");
  const response = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({ client_key: app.clientKey, client_secret: app.clientSecret, ...params }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || data.error || !data.access_token) throw new Error(data.error_description || data.error || `TikTok-token mislukt (${response.status})`);
  return data;
}

const expiresAt = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

type ApiEnvelope<T> = { data?: T; error?: { code: string; message?: string; log_id?: string } };

async function api<T>(path: string, token: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json; charset=UTF-8" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || (data.error && data.error.code !== "ok")) throw new Error(data.error?.message || data.error?.code || `TikTok-request mislukt (${response.status})`);
  return data.data as T;
}

type CreatorInfo = { creator_nickname?: string; creator_username?: string; privacy_level_options?: string[]; comment_disabled?: boolean; duet_disabled?: boolean; stitch_disabled?: boolean; max_video_post_duration_sec?: number };

async function creatorInfo(token: string) {
  return await api<CreatorInfo>("/post/publish/creator_info/query/", token, {});
}

export async function completeTikTokLogin(code: string, redirectUri: string, locale: Locale = "nl") {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
  const user = await api<{ user: { open_id: string; display_name?: string; avatar_url?: string } }>("/user/info/?fields=open_id,display_name,avatar_url", tokens.access_token).catch(() => null);
  const creator = await creatorInfo(tokens.access_token).catch(() => null);
  const previous = await readConnection(locale).catch(() => null);
  await writeConnection(locale, {
    openId: tokens.open_id,
    displayName: creator?.creator_nickname || user?.user.display_name || "TikTok-account",
    avatarUrl: user?.user.avatar_url,
    accessToken: seal(tokens.access_token),
    accessExpiresAt: expiresAt(tokens.expires_in),
    refreshToken: seal(tokens.refresh_token),
    refreshExpiresAt: expiresAt(tokens.refresh_expires_in),
    scope: tokens.scope,
    settings: previous?.openId === tokens.open_id ? previous.settings : DEFAULT_SETTINGS,
    privacyOptions: creator?.privacy_level_options ?? [],
    connectedAt: new Date().toISOString(),
  });
}

/** Geldig access token; ververst automatisch (access 24 uur, refresh een jaar). */
async function accessToken(locale: Locale) {
  const c = await readConnection(locale);
  if (!c) return null;
  if (new Date(c.accessExpiresAt).getTime() - Date.now() > 5 * 60_000) return { token: unseal(c.accessToken), connection: c };
  if (new Date(c.refreshExpiresAt).getTime() < Date.now()) throw new Error("TikTok-koppeling verlopen; koppel opnieuw");
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: unseal(c.refreshToken) });
  const next = { ...c, accessToken: seal(tokens.access_token), accessExpiresAt: expiresAt(tokens.expires_in), refreshToken: seal(tokens.refresh_token), refreshExpiresAt: expiresAt(tokens.refresh_expires_in) };
  await writeConnection(locale, next);
  return { token: tokens.access_token, connection: next };
}

export async function tiktokConnected(locale: Locale = "nl") {
  return Boolean(await readConnection(locale).catch(() => null));
}

export async function updateTikTokSettings(patch: Partial<TikTokSettings>, locale: Locale = "nl") {
  const c = await readConnection(locale);
  if (!c) throw new Error("TikTok is niet gekoppeld");
  const settings = { ...c.settings, ...patch };
  if (settings.mode === "direct" && settings.privacyLevel && c.privacyOptions?.length && !c.privacyOptions.includes(settings.privacyLevel)) {
    throw new Error("Deze zichtbaarheid is voor dit account niet beschikbaar");
  }
  await writeConnection(locale, { ...c, settings });
  return settings;
}

/** Zichtbaarheidsopties opnieuw ophalen (na de audit komt 'iedereen' erbij). */
export async function refreshTikTokCreator(locale: Locale = "nl") {
  const auth = await accessToken(locale);
  if (!auth) return null;
  const creator = await creatorInfo(auth.token);
  await writeConnection(locale, { ...auth.connection, privacyOptions: creator.privacy_level_options ?? [], displayName: creator.creator_nickname || auth.connection.displayName });
  return creator;
}

export async function disconnectTikTok(locale: Locale = "nl") {
  const c = await readConnection(locale);
  if (!c) return;
  const app = tiktokAppConfig();
  if (app) {
    await fetch(`${API}/oauth/revoke/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: app.clientKey, client_secret: app.clientSecret, token: unseal(c.accessToken) }),
    }).catch((error) => console.error("[tiktok] intrekken mislukt", error));
  }
  await writeConnection(locale, null);
}

/* ---------- Publiceren ---------- */

function postInfo(settings: TikTokSettings, privacyLevel: string) {
  return { privacy_level: privacyLevel, disable_comment: !settings.allowComment, disable_duet: !settings.allowDuet, disable_stitch: !settings.allowStitch };
}

function directPrivacy(c: StoredConnection) {
  const level = c.settings.privacyLevel || (c.privacyOptions?.includes("SELF_ONLY") ? "SELF_ONLY" : c.privacyOptions?.[0]);
  if (!level) throw new Error("Kies eerst een zichtbaarheid voor TikTok");
  return level;
}

/** Carrousel als TikTok-fotopost. Geeft het publish_id terug. */
export async function publishTikTokPhotos(post: Post, slideUrls: string[]) {
  const auth = await accessToken(localeOf(post));
  if (!auth) throw new Error("TikTok is niet gekoppeld");
  const { settings } = auth.connection;
  const text = tiktokText(post);
  const direct = settings.mode === "direct";
  const data = await api<{ publish_id: string }>("/post/publish/content/init/", auth.token, {
    post_info: {
      title: text.photoTitle,
      description: text.photoDescription,
      auto_add_music: settings.autoAddMusic,
      ...(direct ? { privacy_level: directPrivacy(auth.connection), disable_comment: !settings.allowComment } : {}),
    },
    source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: slideUrls.slice(0, 35) },
    post_mode: direct ? "DIRECT_POST" : "MEDIA_UPLOAD",
    media_type: "PHOTO",
  });
  return data.publish_id;
}

/** Reel als TikTok-video: wij uploaden het bestand zelf. Geeft het publish_id terug. */
export async function publishTikTokVideo(post: Post) {
  if (!post.video?.file) throw new Error("Reel heeft geen video");
  const auth = await accessToken(localeOf(post));
  if (!auth) throw new Error("TikTok is niet gekoppeld");
  const { settings } = auth.connection;
  const video = await readMedia(post.video.file);
  const { chunkSize, count } = chunkPlan(video.length);
  const sourceInfo = { source: "FILE_UPLOAD", video_size: video.length, chunk_size: chunkSize, total_chunk_count: count };
  const direct = settings.mode === "direct";
  const init = await api<{ publish_id: string; upload_url: string }>(
    direct ? "/post/publish/video/init/" : "/post/publish/inbox/video/init/",
    auth.token,
    direct ? { post_info: { title: tiktokText(post).videoTitle, ...postInfo(settings, directPrivacy(auth.connection)) }, source_info: sourceInfo } : { source_info: sourceInfo },
  );
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = i === count - 1 ? video.length : start + chunkSize;
    const response = await fetch(init.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(end - start), "Content-Range": `bytes ${start}-${end - 1}/${video.length}` },
      body: new Uint8Array(video.subarray(start, end)),
    });
    if (!response.ok) throw new Error(`TikTok-upload mislukt (${response.status})`);
  }
  return init.publish_id;
}

export type TikTokStatus = "processing" | "inbox" | "published" | "failed";

/** Stand van een eerder verstuurde post bij TikTok. */
export async function tiktokPublishStatus(publishId: string, locale: Locale = "nl"): Promise<{ status: TikTokStatus; error?: string; raw?: string }> {
  const auth = await accessToken(locale);
  if (!auth) throw new Error("TikTok is niet gekoppeld");
  const data = await api<{ status: string; fail_reason?: string }>("/post/publish/status/fetch/", auth.token, { publish_id: publishId });
  if (data.status === "PUBLISH_COMPLETE") return { status: "published" };
  if (data.status === "SEND_TO_USER_INBOX") return { status: "inbox" };
  if (data.status === "FAILED") return { status: "failed", error: data.fail_reason || "TikTok kon de post niet verwerken" };
  return { status: "processing", raw: data.status };
}
