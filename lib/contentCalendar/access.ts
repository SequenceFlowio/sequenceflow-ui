import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Toegang tot /contentcalender: één gedeelde toegangscode voor de SequenceFlow-admins,
 * los van de Supabase-login van Support One. Sessie = getekende verlooptijd in een cookie.
 */
export const SESSION_COOKIE = "sf_content_session";
export { APP_PATH, API_PATH } from "./paths";

const encoder = new TextEncoder();

function toBase64Url(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createAccessSession(secret: string, lifetimeSeconds = 60 * 60 * 24 * 7) {
  const expires = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  return `${expires}.${await signature(String(expires), secret)}`;
}

export async function verifyAccessSession(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) return false;
  const [expires, suppliedSignature] = token.split(".");
  if (!expires || !suppliedSignature || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  const expectedSignature = await signature(expires, secret);
  if (expectedSignature.length !== suppliedSignature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedSignature.length; i++) mismatch |= expectedSignature.charCodeAt(i) ^ suppliedSignature.charCodeAt(i);
  return mismatch === 0;
}

export function sessionSecret() {
  return process.env.CONTENT_SESSION_SECRET;
}

export async function hasContentAccess() {
  const store = await cookies();
  return verifyAccessSession(store.get(SESSION_COOKIE)?.value, sessionSecret());
}

/** Voor API-routes: null als de sessie geldig is, anders een 401-response. */
export async function requireContentAccess() {
  if (await hasContentAccess()) return null;
  return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
}

/** Getekende token per post, zodat Meta de gerenderde slides zonder sessie kan ophalen. */
export async function renderToken(postId: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("CONTENT_SESSION_SECRET ontbreekt");
  return (await signature(`render:${postId}`, secret)).slice(0, 32);
}

export async function verifyRenderToken(postId: string, token: string | null) {
  if (!token) return false;
  const expected = await renderToken(postId).catch(() => "");
  if (!expected || expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return mismatch === 0;
}
