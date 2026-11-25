import { verifyTurnstileWith, type TurnstileResult } from "./turnstileCore";

export { type TurnstileResult } from "./turnstileCore";

/** Controleert het Turnstile-token van een formulier. Zie turnstileCore.ts. */
export function verifyTurnstile(token: unknown, ip: string): Promise<TurnstileResult> {
  return verifyTurnstileWith(token, ip, { secret: process.env.TURNSTILE_SECRET_KEY?.trim(), fetchImpl: fetch });
}

export const TURNSTILE_MESSAGE = {
  nl: "De botcheck is niet gelukt. Ververs de pagina en probeer het opnieuw.",
  en: "The bot check didn't pass. Refresh the page and try again.",
};
