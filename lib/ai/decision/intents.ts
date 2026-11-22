/**
 * Vaste lijst soorten klantvraag (docs/plan-werkstroomkern.md, fase 1).
 * De vertrouwensladder rekent per winkel en per soort vraag, dus deze lijst moet
 * vast zijn: het model kiest eruit, en oude vrije tekst ("order_status_inquiry",
 * "klacht beschadiging product") wordt hiernaar vertaald. Puur, zonder aliasimports.
 * De leesbare namen staan in lib/support/labels.ts.
 */

export const SUPPORT_INTENTS = [
  "order_status",
  "shipping",
  "return_request",
  "damaged",
  "missing_items",
  "warranty",
  "complaint",
  "cancellation",
  "payment",
  "invoice",
  "product_question",
  "compliment",
  "fallback",
] as const;

export type SupportIntent = (typeof SUPPORT_INTENTS)[number];

const KNOWN = new Set<string>(SUPPORT_INTENTS);

/** Uitleg voor het model, in de volgorde waarin het moet kiezen bij twijfel. */
export const SUPPORT_INTENT_GUIDE = `
- cancellation: the customer wants to cancel an order
- payment: double charge, failed payment, payment method, refund of a charge without a return
- invoice: the customer asks for an invoice or VAT details
- complaint: the customer is clearly unhappy about service, delay or quality (pick this over the topic when frustration is the point)
- damaged: product arrived broken, leaking or damaged
- missing_items: something is missing from the package, or a wrong item was sent
- warranty: a defect after use, warranty claim
- return_request: the customer wants to return or exchange, or asks about the refund of a return
- order_status: where is my order, delivery date, tracking
- shipping: shipping costs, carriers, delivery countries or times in general (not a specific order)
- product_question: questions about a product, size, stock, subscription or how something works
- compliment: thanks or praise without a question
- fallback: anything else, or when it is unclear`.trim();

const KEYWORDS: Array<[SupportIntent, RegExp]> = [
  ["cancellation", /annul|cancel/],
  ["invoice", /factuur|invoice|btw|vat/],
  ["payment", /afschrijv|betaling|betaal|payment|charge|incasso/],
  ["complaint", /klacht|complain|ontevreden|boos|angry|belachelijk/],
  ["damaged", /beschadig|kapot|gebroken|damage|broken|lek/],
  ["missing_items", /ontbre|missing|mist |verkeerd|wrong item/],
  ["warranty", /garantie|warranty|defect/],
  ["return_request", /retour|return|terugstur|ruil|exchange|refund|terugbetal|geld terug/],
  ["order_status", /status|track|levering|delivery|bezorg|waar is|where is|levertijd|order_/],
  ["shipping", /verzend|shipping|verzendkosten/],
  ["product_question", /product|maat|size|voorraad|stock|abonnement|subscription/],
  ["compliment", /compliment|bedank|thank|dank/],
];

/**
 * Vertaalt wat het model of de historie zegt naar de vaste lijst.
 * `non_customer_*` (van de poortwachter) blijft zoals het is.
 */
export function normalizeIntent(raw: string | null | undefined): SupportIntent | `non_customer_${string}` {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value.startsWith("non_customer_")) return value as `non_customer_${string}`;
  if (KNOWN.has(value)) return value as SupportIntent;
  const base = value.replace(/[\s-]+/g, "_").replace(/_(inquiry|question|request|response|report|melden)$/, "");
  if (KNOWN.has(base)) return base as SupportIntent;
  if (base === "damaged_item") return "damaged";
  for (const [intent, pattern] of KEYWORDS) if (pattern.test(value)) return intent;
  return "fallback";
}
