/** Beslisregels van de poortwachter, zonder imports zodat ze los te testen zijn. */

export const NON_CUSTOMER_CATEGORIES = [
  "supplier",
  "billing",
  "platform",
  "sales",
  "job",
  "internal",
  "other",
] as const;

export type GateCategory = "customer" | (typeof NON_CUSTOMER_CATEGORIES)[number];

export type GateResult = {
  isCustomerQuestion: boolean;
  category: GateCategory;
  confidence: number;
  reason: string;
};

/** Onder deze zekerheid wordt een 'geen klantvraag' toch beantwoord. */
export const GATE_HOLD_CONFIDENCE = 0.85;

/** Pure beslissing: alleen tegenhouden bij een zeker 'nee'. */
export function shouldHoldForGate(result: GateResult | null): boolean {
  if (!result) return false;
  return !result.isCustomerQuestion
    && result.category !== "customer"
    && result.confidence >= GATE_HOLD_CONFIDENCE;
}

/** Leest het JSON-antwoord streng; alles wat niet klopt telt als 'doorlaten'. */
export function parseGateResponse(raw: string | null | undefined): GateResult | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.is_customer_question !== "boolean") return null;
  const confidence = Number(record.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  const rawCategory = String(record.category ?? "").toLowerCase();
  const category: GateCategory = rawCategory === "customer"
    ? "customer"
    : (NON_CUSTOMER_CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as GateCategory)
      : "other";
  return {
    isCustomerQuestion: record.is_customer_question,
    category: record.is_customer_question ? "customer" : category,
    confidence,
    reason: String(record.reason ?? "").slice(0, 200),
  };
}
