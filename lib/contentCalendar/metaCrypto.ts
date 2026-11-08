import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Cryptografie van de Meta-koppeling, los van database en API zodat het te testen is:
 * tokens versleutelen, de signed_request van Meta controleren en de OAuth-state ondertekenen.
 */

function key() {
  const secret = process.env.CONTENT_SESSION_SECRET;
  if (!secret) throw new Error("CONTENT_SESSION_SECRET ontbreekt");
  return createHash("sha256").update(`meta-connection:${secret}`).digest();
}

export function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function unseal(value: string) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Meta stuurt bij verwijderverzoek of ontkoppelen een signed_request; wis dan alles van die gebruiker. */
export function parseSignedRequest(signedRequest: string) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) throw new Error("META_APP_SECRET ontbreekt");
  const [signature, payload] = signedRequest.split(".");
  if (!signature || !payload) throw new Error("Ongeldige signed_request");
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new Error("Ongeldige handtekening");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { user_id?: string; algorithm?: string };
}

/** Ondertekende state tegen CSRF in de OAuth-redirect. */
export function signState(nonce: string) {
  return `${nonce}.${createHmac("sha256", key()).update(nonce).digest("base64url").slice(0, 32)}`;
}

export function verifyState(state: string | null, cookieNonce: string | undefined) {
  if (!state || !cookieNonce) return false;
  const expected = signState(cookieNonce);
  return state.length === expected.length && timingSafeEqual(Buffer.from(state), Buffer.from(expected));
}
