import { createHmac, timingSafeEqual } from "node:crypto";

export type ShopifyIdentity = { shop: string; subject: string; sessionId: string };

/** Validate before using any claim for tenant selection or outbound requests. */
export function verifyShopifySessionToken(
  token: string,
  credentials: { clientId: string; secret: string },
  now = Math.floor(Date.now() / 1000),
): ShopifyIdentity {
  const invalid = () => new Error("Invalid Shopify session");
  if (!credentials.clientId || !credentials.secret || token.length > 16384) throw invalid();
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw invalid();
  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", credentials.secret).update(`${header}.${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
  try {
    const h = JSON.parse(Buffer.from(header, "base64url").toString());
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (h.alg !== "HS256" || p.aud !== credentials.clientId ||
        !Number.isFinite(p.exp) || p.exp <= now ||
        !Number.isFinite(p.nbf) || p.nbf > now ||
        !Number.isFinite(p.iat) || p.iat > now ||
        typeof p.sub !== "string" || !/^\d+$/.test(p.sub) ||
        typeof p.sid !== "string" || !p.sid ||
        typeof p.dest !== "string" || !/^https:\/\/[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(p.dest) ||
        p.iss !== `${p.dest}/admin`) throw invalid();
    return { shop: new URL(p.dest).hostname, subject: p.sub, sessionId: p.sid };
  } catch { throw invalid(); }
}

export function verifyShopifyWebhook(body: Buffer, signature: string, secret: string) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
