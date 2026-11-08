import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { seal, unseal } from "./metaCrypto.ts";

export { parseSignedRequest, seal, signState, unseal, verifyState } from "./metaCrypto.ts";

/**
 * Koppeling met Instagram en Facebook via de eigen Meta-app van SequenceFlow
 * ("Inloggen met Facebook"). Dit is de flow die Meta in App Review wil zien en die
 * later Content One gebruikt. Zonder koppeling vallen we terug op de tokens in de env
 * (META_ACCESS_TOKEN + META_IG_USER_ID / META_PAGE_ID).
 *
 * De koppeling staat versleuteld in content_queue onder id "meta-connection",
 * zodat er geen nieuwe tabel nodig is.
 */
export const GRAPH_VERSION = "v23.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const CONNECTION_ID = "meta-connection";

/** Precies de rechten die we gebruiken; elk recht moet in App Review worden onderbouwd. */
export const META_SCOPES = [
  "pages_show_list", // pagina's van de gebruiker tonen om er één te kiezen
  "pages_read_engagement", // reacties en shares van eigen posts lezen
  "pages_manage_posts", // posts publiceren op de Facebook-pagina
  "instagram_basic", // het gekoppelde Instagram-account en zijn posts lezen
  "instagram_content_publish", // carrousels publiceren op Instagram
  "instagram_manage_insights", // bereik, saves en shares van eigen posts
  "business_management", // pagina's die in een Business-portfolio staan
] as const;

export function metaAppConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}

/* ---------- Opslag ---------- */

export interface MetaPage {
  id: string;
  name: string;
  igId?: string;
  igUsername?: string;
  token: string; // versleuteld
}

interface StoredConnection {
  facebookUserId: string;
  facebookUserName: string;
  userToken: string; // versleuteld, om bij ontkoppelen de rechten in te trekken
  pages: MetaPage[];
  selectedPageId?: string;
  connectedAt: string;
}

async function readConnection(): Promise<StoredConnection | null> {
  const { data } = await getSupabaseAdmin().from("content_queue").select("data").eq("id", CONNECTION_ID).maybeSingle();
  return (data?.data as StoredConnection | null) ?? null;
}

async function writeConnection(connection: StoredConnection | null) {
  const db = getSupabaseAdmin().from("content_queue");
  const { error } = connection
    ? await db.upsert({ id: CONNECTION_ID, data: connection, updated_at: new Date().toISOString() })
    : await db.delete().eq("id", CONNECTION_ID);
  if (error) throw new Error(error.message);
}

/** Wat de app laat zien (zonder tokens). */
export async function connectionSummary() {
  const connection = await readConnection().catch(() => null);
  if (!connection) return null;
  return {
    facebookUserName: connection.facebookUserName,
    connectedAt: connection.connectedAt,
    selectedPageId: connection.selectedPageId ?? null,
    pages: connection.pages.map(({ id, name, igId, igUsername }) => ({ id, name, igId: igId ?? null, igUsername: igUsername ?? null })),
  };
}

/** Token en ids om mee te publiceren en te meten: eerst de koppeling, anders de env. */
export async function metaConfig() {
  const connection = await readConnection().catch(() => null);
  const page = connection?.pages.find((p) => p.id === connection.selectedPageId);
  if (page) return { token: unseal(page.token), pageId: page.id, igUserId: page.igId, source: "login" as const };
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  const igUserId = process.env.META_IG_USER_ID;
  if (!token || (!pageId && !igUserId)) return null;
  return { token, pageId, igUserId, source: "env" as const };
}

/* ---------- OAuth ---------- */

export function authorizeUrl(redirectUri: string, state: string) {
  const app = metaAppConfig();
  if (!app) throw new Error("META_APP_ID en META_APP_SECRET ontbreken");
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", app.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  // Facebook Login for Business werkt met een configuratie-ID (met daarin dezelfde rechten); anders de losse rechten
  const configId = process.env.META_LOGIN_CONFIG_ID;
  if (configId) url.searchParams.set("config_id", configId);
  else url.searchParams.set("scope", META_SCOPES.join(","));
  return url.toString();
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error?.message ?? `Meta request mislukt (${response.status})`);
  return data as T;
}

/** Code → langlevende gebruikerstoken → pagina's met hun (niet-verlopende) paginatoken en Instagram-account. */
export async function completeLogin(code: string, redirectUri: string) {
  const app = metaAppConfig();
  if (!app) throw new Error("META_APP_ID en META_APP_SECRET ontbreken");
  const short = await graph<{ access_token: string }>("oauth/access_token", { client_id: app.appId, client_secret: app.appSecret, redirect_uri: redirectUri, code });
  const long = await graph<{ access_token: string }>("oauth/access_token", { grant_type: "fb_exchange_token", client_id: app.appId, client_secret: app.appSecret, fb_exchange_token: short.access_token });
  const me = await graph<{ id: string; name: string }>("me", { fields: "id,name", access_token: long.access_token });
  const accounts = await graph<{ data: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }> }>(
    "me/accounts", { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100", access_token: long.access_token },
  );
  const pages: MetaPage[] = accounts.data.map((p) => ({ id: p.id, name: p.name, igId: p.instagram_business_account?.id, igUsername: p.instagram_business_account?.username, token: seal(p.access_token) }));
  const previous = await readConnection().catch(() => null);
  // Eén pagina met Instagram? Dan meteen kiezen. Anders de vorige keuze houden als die er nog is.
  const withInstagram = pages.filter((p) => p.igId);
  const selectedPageId = pages.some((p) => p.id === previous?.selectedPageId) ? previous!.selectedPageId : withInstagram.length === 1 ? withInstagram[0].id : pages.length === 1 ? pages[0].id : undefined;
  await writeConnection({ facebookUserId: me.id, facebookUserName: me.name, userToken: seal(long.access_token), pages, selectedPageId, connectedAt: new Date().toISOString() });
  return { pages: pages.length, selected: Boolean(selectedPageId) };
}

export async function selectPage(pageId: string) {
  const connection = await readConnection();
  if (!connection?.pages.some((p) => p.id === pageId)) throw new Error("Pagina niet gevonden in de koppeling");
  await writeConnection({ ...connection, selectedPageId: pageId });
}

/** Ontkoppelen: rechten intrekken bij Meta en alle tokens wissen. */
export async function disconnect() {
  const connection = await readConnection();
  if (!connection) return;
  try {
    await fetch(`${GRAPH_BASE}/${connection.facebookUserId}/permissions?access_token=${encodeURIComponent(unseal(connection.userToken))}`, { method: "DELETE" });
  } catch (error) {
    console.error("[meta] rechten intrekken mislukt", error);
  }
  await writeConnection(null);
}

export async function deleteDataForFacebookUser(facebookUserId: string) {
  const connection = await readConnection();
  if (connection?.facebookUserId === facebookUserId) await writeConnection(null);
}
