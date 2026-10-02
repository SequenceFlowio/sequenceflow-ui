const CUSTOMER_INTENTS = new Set([
  "order_status",
  "return_request",
  "damaged",
  "damaged_item",
  "missing_items",
  "complaint",
  "warranty",
  "cancellation",
  "payment",
  "invoice",
  "shipping",
  "product_question",
  "compliment",
  "fallback",
  "other",
  "unknown",
]);

/**
 * Keep analytics tied to the support intent classifier. Unknown model output
 * is grouped into "fallback" instead of becoming a made-up analytics topic.
 */
export function customerAnalyticsIntent(value: string | null | undefined) {
  const intent = value?.trim().toLowerCase();
  if (!intent || intent.startsWith("non_customer_")) return null;
  const base = intent.replace(/_(inquiry|question|request)$/, "");
  if (!CUSTOMER_INTENTS.has(intent) && !CUSTOMER_INTENTS.has(base)) return "fallback";
  if (base === "damaged_item") return "damaged";
  if (["other", "unknown"].includes(base)) return "fallback";
  return base;
}

export function isCustomerAnalyticsRow(row: { intent?: string | null; status?: string | null }) {
  return row.status !== "spam" && customerAnalyticsIntent(row.intent) !== null;
}
