export type CommerceClaimFacts = {
  cancelledAt: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  hasFulfillment: boolean;
} | null;

const CANCELLATION_CONFIRMATION = [
  /\b(?:order|bestelling).{0,45}\b(?:is|werd|was|has been)\s+(?:succesvol\s+|successfully\s+)?(?:geannuleerd|cancelled|canceled)\b/i,
  /\b(?:we|wij)\s+(?:hebben|have)\s+(?:de|the|uw|your)?\s*(?:order|bestelling).{0,35}\b(?:geannuleerd|cancelled|canceled)\b/i,
  /\b(?:we|wij)\s+(?:have|hebben)\s+(?:successfully\s+|succesvol\s+)?(?:cancelled|canceled|geannuleerd)\s+(?:the|your|de|uw)?\s*(?:order|bestelling)\b/i,
];
const REFUND_CONFIRMATION = [
  /\b(?:refund|terugbetaling).{0,35}\b(?:is|was|has been)\s+(?:uitgevoerd|verwerkt|issued|processed|completed)\b/i,
  /\b(?:bedrag|money|payment).{0,35}\b(?:is|has been)\s+(?:teruggestort|refunded)\b/i,
];
const SHIPPING_CONFIRMATION = [
  /\b(?:order|bestelling|pakket).{0,45}\b(?:is|was|has been)\s+(?:verzonden|shipped|dispatched)\b/i,
  /\b(?:we|wij)\s+(?:hebben|have)\s+(?:de|the|uw|your)?\s*(?:order|bestelling|pakket).{0,35}\b(?:verzonden|shipped|dispatched)\b/i,
];

/**
 * Een voorwaarde of vraag beweert niets: "zodra het pakket is verzonden",
 * "we controleren of de terugbetaling al is verwerkt", "is het al verzonden?".
 * Alleen als zo'n woord vóór de bewering in hetzelfde zinsdeel staat; "je pakket
 * is verzonden en zodra het aankomt…" blijft een bewering. Gevonden met de live
 * testset (docs/plan-werkstroomkern.md): zonder dit vervangt de pipeline goede
 * concepten door het terugvalconcept.
 */
const CONDITIONAL = /\b(?:zodra|nadat|wanneer|of (?:het|de|je|jouw|uw|er)|once|as soon as|whether|when|if)\b/i;

function assertiveClauses(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !sentence.trim().endsWith("?"))
    .flatMap((sentence) => sentence.split(/[,;:]\s*/))
    .map((clause) => clause.trim())
    .filter(Boolean);
}

/** "nog niet is verzonden", "not been shipped": een ontkenning in of vlak voor de bewering. */
const NEGATION = /\b(?:niet|nooit|not|never)\b|n't\b/i;

/** Eerste stellige treffer van het patroon (geen vraag, voorwaarde of ontkenning), of null. */
export function assertiveMatch(text: string, pattern: RegExp): string | null {
  for (const clause of assertiveClauses(text)) {
    const match = pattern.exec(clause);
    if (!match) continue;
    // Telt alleen als er tot en met de bewering geen voorwaardewoord staat.
    if (CONDITIONAL.test(clause.slice(0, match.index + match[0].length))) continue;
    if (NEGATION.test(match[0]) || NEGATION.test(clause.slice(Math.max(0, match.index - 12), match.index))) continue;
    return match[0];
  }
  return null;
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => assertiveMatch(text, pattern) !== null);
}

export function containsCancellationConfirmation(body: string) {
  return matchesAny(body, CANCELLATION_CONFIRMATION);
}

export function unverifiedCommerceClaims(body: string, facts: CommerceClaimFacts) {
  const issues: string[] = [];
  if (containsCancellationConfirmation(body) && !facts?.cancelledAt) issues.push("cancellation");
  const financial = String(facts?.financialStatus ?? "").toUpperCase();
  if (matchesAny(body, REFUND_CONFIRMATION) && !["REFUNDED", "PARTIALLY_REFUNDED"].includes(financial)) issues.push("refund");
  const fulfillment = String(facts?.fulfillmentStatus ?? "").toUpperCase();
  if (matchesAny(body, SHIPPING_CONFIRMATION) && !facts?.hasFulfillment && !["FULFILLED", "PARTIALLY_FULFILLED", "IN_PROGRESS"].includes(fulfillment)) issues.push("shipping");
  return issues;
}
