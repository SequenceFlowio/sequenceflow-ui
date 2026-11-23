import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Reel-video's staan op de Hetzner-server (media.sequenceflow.io), niet in
 * Supabase: dat scheelt opslag en vooral dataverkeer, want Instagram, TikTok
 * en YouTube halen elke video op. Links zijn tijdelijk en ondertekend met
 * MEDIA_SIGNING_SECRET; de server (content-reels/scripts/media-server.mjs)
 * controleert precies dezelfde handtekening.
 *
 * Geen imports met een alias: de tests laden dit bestand direct.
 */

export const MEDIA_FILE = /^[\w.-]+\.(mp4|jpg|jpeg|png)$/;

const b64url = (buffer: Buffer) => buffer.toString("base64url");

export function mediaSignature(secret: string, file: string, exp: number) {
  return b64url(createHmac("sha256", secret).update(`v1:${file}:${exp}`).digest());
}

/** Tijdelijke link naar één bestand op de mediaserver. */
export function signedMediaServerUrl(base: string, secret: string, file: string, ttlSeconds: number, now = Date.now()) {
  if (!MEDIA_FILE.test(file)) throw new Error("Ongeldige bestandsnaam");
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${base.replace(/\/$/, "")}/v/${file}?exp=${exp}&sig=${mediaSignature(secret, file, exp)}`;
}

export function verifyMediaSignature(secret: string, file: string, exp: number, sig: string, now = Date.now()) {
  if (!MEDIA_FILE.test(file) || !Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = Buffer.from(mediaSignature(secret, file, exp));
  const given = Buffer.from(String(sig));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Opdracht om bestanden te verwijderen, ondertekend en maar 5 minuten geldig. */
export function signedDeleteRequest(secret: string, files: string[], now = Date.now()) {
  const ts = Math.floor(now / 1000);
  const sig = b64url(createHmac("sha256", secret).update(`del:${files.join(",")}:${ts}`).digest());
  return { files, ts, sig };
}

/** Bestandsnaam van een reel-video → id van de post (reelFiles in reels.ts). */
export function postIdFromVideoFile(file: string) {
  return file.match(/^(.+)-reel\.mp4$/)?.[1] ?? null;
}
