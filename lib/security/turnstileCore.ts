/**
 * Cloudflare Turnstile (botcheck) op de openbare formulieren: gratis
 * downloads en affiliate-aanmelding. De login gebruikt Turnstile via
 * Supabase zelf (Auth → Attack Protection), want bots kunnen de Supabase-API
 * ook rechtstreeks aanroepen met de publieke sleutel.
 *
 * Zonder TURNSTILE_SECRET_KEY slaan we de check over, zodat een deploy zonder
 * sleutels het formulier niet breekt. Geen imports met een alias: de tests
 * laden dit bestand direct.
 */

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true; skipped: boolean } | { ok: false; reason: string };

type Fetch = (url: string, init: { method: string; body: URLSearchParams }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export async function verifyTurnstileWith(
  token: unknown,
  ip: string,
  { secret, fetchImpl }: { secret: string | undefined; fetchImpl: Fetch },
): Promise<TurnstileResult> {
  if (!secret) return { ok: true, skipped: true };
  if (typeof token !== "string" || !token || token.length > 2048) return { ok: false, reason: "missing-token" };
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, { method: "POST", body });
    const data = await response.json() as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true, skipped: false };
    return { ok: false, reason: (data["error-codes"] ?? []).join(",") || "rejected" };
  } catch (error) {
    // Cloudflare onbereikbaar: liever een echte aanmelding doorlaten dan iedereen blokkeren.
    console.error("[turnstile] verify failed; allowing request", error);
    return { ok: true, skipped: true };
  }
}
