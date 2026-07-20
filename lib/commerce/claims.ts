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

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
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
