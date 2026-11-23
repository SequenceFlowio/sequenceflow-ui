/**
 * Inloggen met e-mail (naast Google): Supabase stuurt een mail met een
 * inloglink en een code van 6 cijfers. Geen imports met een alias: de tests
 * laden dit bestand direct.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase().slice(0, 200);
  return EMAIL_PATTERN.test(email) ? email : null;
}

/** De code uit de mail: Supabase gebruikt 6 cijfers (8 als dat in het project is ingesteld). Spaties mogen. */
export function normalizeCode(value: unknown): string | null {
  const code = String(value ?? "").replace(/\s+/g, "");
  return /^\d{6,8}$/.test(code) ? code : null;
}

/** Foutmelding van Supabase vertaald naar iets wat een mens begrijpt. */
export function emailLoginError(message: string | undefined, lang: "nl" | "en"): string {
  const m = (message ?? "").toLowerCase();
  const nl = lang === "nl";
  if (m.includes("captcha")) return nl ? "De botcheck is niet gelukt. Probeer het opnieuw." : "The bot check didn't pass. Please try again.";
  if (m.includes("rate") || m.includes("security purposes") || m.includes("too many")) {
    return nl ? "Je hebt net al een mail gekregen. Wacht een minuut en probeer het dan opnieuw." : "We just sent you an email. Wait a minute and try again.";
  }
  if (m.includes("expired") || m.includes("invalid") || m.includes("otp")) {
    return nl ? "Deze code klopt niet of is verlopen. Vraag een nieuwe aan." : "This code is wrong or has expired. Request a new one.";
  }
  return nl ? "Dat lukte niet. Probeer het opnieuw of log in met Google." : "That didn't work. Try again or continue with Google.";
}
