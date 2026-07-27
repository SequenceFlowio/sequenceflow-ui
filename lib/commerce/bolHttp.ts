import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { CommerceConnection } from "@/lib/commerce/types";
import { bolTokenNeedsRefresh, decodeBolAccountId } from "@/lib/commerce/bolCore";

const BOL_TOKEN_URL = "https://login.bol.com/token";
const BOL_API_URL = "https://api.bol.com";
export { bolTokenNeedsRefresh, decodeBolAccountId } from "@/lib/commerce/bolCore";

export class BolRequestError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, status: number | null, retryable: boolean) {
    super(message);
    this.name = "BolRequestError";
    this.status = status;
    this.retryable = retryable;
  }
}

function tokenExpiry(expiresIn: number | undefined) {
  const seconds = Number.isFinite(expiresIn) ? Math.max(60, Number(expiresIn)) : 299;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function safeBolError(payload: unknown, status: number) {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const detail = typeof body.detail === "string" ? body.detail
    : typeof body.error_description === "string" ? body.error_description
      : typeof body.title === "string" ? body.title : null;
  if (status === 401 || status === 403) return "bol.com heeft de API-gegevens geweigerd. Controleer de Client ID en secret.";
  if (status === 429) return "bol.com begrenst tijdelijk het aantal verzoeken. SequenceFlow probeert het opnieuw.";
  if (status >= 500) return "bol.com is tijdelijk niet bereikbaar.";
  return detail?.slice(0, 240) || `bol.com request failed (${status}).`;
}

async function exchangeToken(connection: CommerceConnection, fetchImpl: typeof fetch = fetch) {
  const credentials = Buffer.from(`${connection.clientId}:${decryptSecret(connection.clientSecretEncrypted)}`).toString("base64");
  let response: Response;
  try {
    response = await fetchImpl(BOL_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new BolRequestError("bol.com token exchange kon niet worden voltooid.", null, true);
  }
  const payload = await response.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new BolRequestError(safeBolError(payload, response.status), response.status, response.status === 429 || response.status >= 500);
  }
  const expiresAt = tokenExpiry(payload.expires_in);
  const scopes = String(payload.scope ?? "").split(/\s+/).filter(Boolean);
  const { error } = await getSupabaseAdmin().from("commerce_connections").update({
    access_token_encrypted: encryptSecret(payload.access_token),
    token_expires_at: expiresAt,
    scopes,
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("tenant_id", connection.tenantId);
  if (error) throw new Error(`Could not persist the bol.com token: ${error.message}`);
  return { token: payload.access_token, expiresAt, scopes, accountId: decodeBolAccountId(payload.access_token) };
}

export async function getBolAccessToken(connection: CommerceConnection, force = false, fetchImpl: typeof fetch = fetch) {
  if (!force && connection.accessTokenEncrypted && !bolTokenNeedsRefresh(connection.tokenExpiresAt)) {
    return {
      token: decryptSecret(connection.accessTokenEncrypted),
      expiresAt: connection.tokenExpiresAt,
      scopes: connection.scopes,
      accountId: decodeBolAccountId(decryptSecret(connection.accessTokenEncrypted)),
    };
  }
  return exchangeToken(connection, fetchImpl);
}

type BolRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  version?: 10 | 11;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
};

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function bolRequest<T>(connection: CommerceConnection, path: string, options: BolRequestOptions = {}): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? 2;
  const version = options.version ?? 10;
  let token = (await getBolAccessToken(connection, false, fetchImpl)).token;
  let refreshed = false;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(`${BOL_API_URL}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: `application/vnd.retailer.v${version}+json`,
          ...(options.body === undefined ? {} : {
            "Content-Type": `application/vnd.retailer.v${version}+json`,
          }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      if (attempt < maxRetries) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      throw new BolRequestError("bol.com reageerde niet op tijd.", null, true);
    }

    if (response.status === 401 && !refreshed) {
      token = (await getBolAccessToken(connection, true, fetchImpl)).token;
      refreshed = true;
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5_000)
        : 300 * 2 ** attempt);
      continue;
    }
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new BolRequestError(
        safeBolError(payload, response.status),
        response.status,
        response.status === 429 || response.status >= 500,
      );
    }
    return payload as T;
  }
  throw new BolRequestError("bol.com request exhausted its retry budget.", null, true);
}
