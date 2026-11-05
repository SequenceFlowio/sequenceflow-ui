/**
 * A small, deterministic language guess for customer e-mail, without a model.
 * It only has to be sure about one thing: "this is English", so the pipeline
 * can skip translating English into English. Anything unsure returns null and
 * the model decides, as before.
 */

export type DetectedLanguage = { language: "nl" | "en" | "de" | "fr"; confidence: number; words: number };

const STOPWORDS: Record<DetectedLanguage["language"], string[]> = {
  en: ["the", "and", "is", "are", "was", "were", "have", "has", "with", "for", "you", "your", "my", "this", "that", "not", "but", "order", "please", "would", "could", "can", "i", "it", "to", "of", "in", "on", "when", "still", "received", "thanks", "thank", "hello", "hi", "regards"],
  nl: ["de", "het", "een", "en", "is", "zijn", "was", "heb", "hebben", "met", "voor", "je", "jullie", "uw", "mijn", "dit", "dat", "niet", "maar", "bestelling", "graag", "zou", "kunnen", "kan", "ik", "ook", "nog", "van", "op", "wanneer", "ontvangen", "bedankt", "dank", "hallo", "hoi", "groet", "groeten", "alvast"],
  de: ["der", "die", "das", "und", "ist", "sind", "war", "habe", "haben", "mit", "für", "sie", "ihre", "mein", "meine", "nicht", "aber", "bestellung", "bitte", "würde", "könnte", "kann", "ich", "auch", "noch", "von", "auf", "wann", "erhalten", "danke", "hallo", "grüße", "freundlichen"],
  fr: ["le", "la", "les", "et", "est", "sont", "était", "ai", "avons", "avec", "pour", "vous", "votre", "mon", "ma", "ce", "cette", "pas", "mais", "commande", "merci", "pourriez", "peux", "je", "aussi", "encore", "de", "sur", "quand", "reçu", "bonjour", "cordialement"],
};

const SETS = Object.fromEntries(Object.entries(STOPWORDS).map(([language, words]) => [language, new Set(words)])) as Record<DetectedLanguage["language"], Set<string>>;

export function detectLanguage(text: string): DetectedLanguage | null {
  const tokens = text.toLowerCase().match(/[a-zäöüßéèêàçëïî']+/g) ?? [];
  if (tokens.length < 8) return null;
  const scores: Record<DetectedLanguage["language"], number> = { en: 0, nl: 0, de: 0, fr: 0 };
  for (const token of tokens) for (const language of Object.keys(scores) as DetectedLanguage["language"][]) if (SETS[language].has(token)) scores[language] += 1;
  const ranked = (Object.entries(scores) as Array<[DetectedLanguage["language"], number]>).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (best[1] === 0) return null;
  // Confidence: the winner's share of all stopword hits, discounted when the runner-up is close.
  const total = ranked.reduce((sum, [, score]) => sum + score, 0);
  const confidence = (best[1] / total) * Math.min(1, (best[1] - second[1]) / 3 + 0.4);
  return { language: best[0], confidence: Math.round(confidence * 100) / 100, words: tokens.length };
}

/** True only when the text is clearly English: enough words, a clear winner, a real margin. */
export function looksEnglish(text: string) {
  const detected = detectLanguage(text);
  return Boolean(detected && detected.language === "en" && detected.confidence >= 0.75 && detected.words >= 12);
}
