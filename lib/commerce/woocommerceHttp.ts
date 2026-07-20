import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { CommerceConnection } from "./types.ts";
import { decryptSecret } from "../security/credentials.ts";

export class WooCommerceRequestError extends Error {
  readonly unknownMutationOutcome: boolean;
  constructor(message: string, unknownMutationOutcome = false) {
    super(message);
    this.unknownMutationOutcome = unknownMutationOutcome;
  }
}

export function normalizeWooCommerceUrl(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Use the full HTTPS URL of the WooCommerce store."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Use a public HTTPS store URL without credentials, query parameters, or fragments.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) throw new Error("The WooCommerce store must be publicly reachable.");
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

function privateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
}

async function assertPublicHost(storeUrl: string) {
  const host = new URL(storeUrl).hostname;
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) throw new Error("The WooCommerce store resolves to a private network address.");
}

export async function wooRequest<T>(connection: CommerceConnection, path: string, init: RequestInit = {}): Promise<T> {
  await assertPublicHost(connection.shopDomain);
  const url = new URL(`${connection.shopDomain}/wp-json/wc/v3/${path.replace(/^\//, "")}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const mutating = Boolean(init.method && init.method !== "GET");
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${connection.clientId}:${decryptSecret(connection.clientSecretEncrypted)}`).toString("base64")}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) throw new WooCommerceRequestError(payload.message || `WooCommerce request failed (${response.status}).`);
    return payload as T;
  } catch (error) {
    if (error instanceof WooCommerceRequestError) throw error;
    throw new WooCommerceRequestError(mutating ? "WooCommerce may have received the mutation; provider state must be checked before retrying." : "WooCommerce could not be reached.", mutating);
  } finally { clearTimeout(timeout); }
}
