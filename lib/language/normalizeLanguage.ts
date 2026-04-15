const LANGUAGE_ALIASES: Record<string, string> = {
  nl: "nl",
  "nl-nl": "nl",
  dutch: "nl",
  nederlands: "nl",

  en: "en",
  "en-gb": "en",
  "en-us": "en",
  english: "en",
  engels: "en",

  de: "de",
  "de-de": "de",
  german: "de",
  deutsch: "de",
  duits: "de",

  fr: "fr",
  "fr-fr": "fr",
  french: "fr",
  francais: "fr",
  frans: "fr",

  es: "es",
  "es-es": "es",
  spanish: "es",
  espanol: "es",
  spaans: "es",

  it: "it",
  "it-it": "it",
  italian: "it",
  italiano: "it",
  italiaans: "it",

  pt: "pt",
  "pt-pt": "pt",
  "pt-br": "pt",
  portuguese: "pt",
  portugues: "pt",
  portugees: "pt",
};

export function normalizeLanguage(value?: string | null): string | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized || ["unknown", "auto", "und", "null", "undefined"].includes(normalized)) {
    return null;
  }

  if (LANGUAGE_ALIASES[normalized]) {
    return LANGUAGE_ALIASES[normalized];
  }

  const base = normalized.split("-")[0];
  if (LANGUAGE_ALIASES[base]) {
    return LANGUAGE_ALIASES[base];
  }

  return /^[a-z]{2}$/.test(base) ? base : null;
}
