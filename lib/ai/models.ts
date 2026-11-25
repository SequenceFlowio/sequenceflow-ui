/**
 * Alle modelnamen op één plek (docs/plan-werkstroomkern.md, fase 0c).
 *
 * Wissel je een model dat klantmail raakt (beslissing, poort, vertaling),
 * draai dan eerst `npm run eval:support` en zet de score in de PR.
 * Prijzen per model staan in lib/internal/costs.ts; voeg een nieuw model daar ook toe.
 * Waar een omgevingsvariabele bestaat, wint die (bijvoorbeeld voor een proef).
 */

/** Schrijft het concept en kiest de beslissing voor een binnenkomende klantmail. */
export const DECISION_MODEL = "gpt-4.1-mini";

/** Poortwachter: is dit wel een klantvraag? */
export const GATE_MODEL = "gpt-4.1-mini";
/** Draait in de schaduw mee bij de poort; overstappen pas bij bewezen gelijkwaardigheid. */
export const GATE_SHADOW_MODEL = "gpt-4.1-nano";

/** Vertaalt mails en concepten voor de inbox. */
export const TRANSLATION_MODEL = "gpt-4.1-mini";

/** Leert van menselijke correcties op concepten (learn-from-edits). */
export const LEARNING_MODEL = "gpt-4.1-mini";

/** Haalt kennis uit de Verzonden-map van een winkel. */
export const MINING_MODEL = "gpt-4.1-mini";
/** Vat het agentprofiel samen uit de gedolven mails. */
export const DISTILL_MODEL_DEFAULT = "gpt-5.4-mini-2026-03-17";

/** Pijnpunten en de wekelijkse commerce-briefing. */
export const ANALYTICS_MODEL = "gpt-4.1-mini";

/** Otis: voorraadmails en de voorraadassistent. */
export const INVENTORY_EMAIL_MODEL = "gpt-4.1-mini";
export const INVENTORY_ASSISTANT_MODEL_DEFAULT = "gpt-4.1-mini";

/** Chat op de marketingsite. */
export const MARKETING_CHAT_MODEL = "gpt-4.1-mini";

/** Lumen (interne chat). */
export const LUMEN_MODEL_DEFAULT = "gpt-5.4-mini-2026-03-17";

/** Vertaling van contentkalender-posts. */
export const CONTENT_TRANSLATE_MODEL_DEFAULT = "gpt-4.1";

/** Embeddings voor de kennisbank en het agentprofiel. */
export const EMBEDDING_MODEL = "text-embedding-3-small";
