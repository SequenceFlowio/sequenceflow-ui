import type { Post } from "./types";
import { localeOf, type Locale } from "./locale.ts";
import { ZERNIO_ID_PREFIX, pickZernioAccount, zernioPostBody, zernioTikTokStatus, zernioUsername, type ZernioAccount, type ZernioMedia, type ZernioPost } from "./zernioFormat.ts";

/** Zernio-API (zie zernioFormat.ts). Staat aan zodra ZERNIO_API_KEY gezet is. */
const API = "https://zernio.com/api/v1";

export function zernioConfigured() {
  return Boolean(process.env.ZERNIO_API_KEY?.trim());
}

async function zernio<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY!.trim()}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string | { message?: string }; message?: string };
  if (!response.ok && response.status !== 207) {
    const error = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(`Zernio: ${error || data.message || `request mislukt (${response.status})`}`);
  }
  return data;
}

async function accountId(locale: Locale) {
  const username = zernioUsername(locale);
  const { accounts } = await zernio<{ accounts: ZernioAccount[] }>("/accounts?platform=tiktok");
  const account = pickZernioAccount(accounts ?? [], username);
  if (!account) throw new Error(`Zernio: TikTok-account @${username} niet gekoppeld`);
  return account._id;
}

/** Plaatst de post meteen openbaar op TikTok; geeft ons publish-id ("zernio:<id>") en de eerste stand terug. */
export async function publishViaZernio(post: Post, media: ZernioMedia) {
  const body = zernioPostBody(post, await accountId(localeOf(post)), media);
  const data = await zernio<{ post?: ZernioPost }>("/posts", body);
  if (!data.post?._id) throw new Error("Zernio gaf geen post-id terug");
  return { id: `${ZERNIO_ID_PREFIX}${data.post._id}`, ...zernioTikTokStatus(data.post) };
}

export async function zernioPublishStatus(id: string) {
  const data = await zernio<{ post?: ZernioPost }>(`/posts/${encodeURIComponent(id.slice(ZERNIO_ID_PREFIX.length))}`);
  return zernioTikTokStatus(data.post ?? {});
}
