import crypto from "crypto";

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function orderCustomerIdentityMatches(orderEmail: string | null | undefined, senderEmail: string) {
  if (!orderEmail?.trim() || !senderEmail.trim()) return false;
  return normalizeCustomerEmail(orderEmail) === normalizeCustomerEmail(senderEmail);
}

export function customerKey(tenantId: string, email: string) {
  const key = process.env.COMMERCE_IDENTITY_HMAC_KEY?.trim();
  if (!key) throw new Error("COMMERCE_IDENTITY_HMAC_KEY is not configured.");
  return crypto.createHmac("sha256", key).update(`${tenantId}:${normalizeCustomerEmail(email)}`).digest("hex");
}

export function normalizeOrderNumber(value: string) {
  return value.trim().replace(/^#/, "").toUpperCase();
}

export function extractOrderNumbers(text: string) {
  const found = new Set<string>();
  const patterns = [
    /(?:order|bestelling|ordernummer|bestelnummer)\s*(?:nr\.?|nummer|#|:)?\s*#?([a-z0-9-]{3,32})/gi,
    /#([0-9]{3,16})\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.add(normalizeOrderNumber(match[1]));
  }
  return [...found];
}

export function selectOrdersMatchingReferences<T extends { displayName: string }>(orders: T[], orderNumbers: string[]) {
  const normalized = new Set(orderNumbers.map(normalizeOrderNumber));
  return orders.filter((order) => normalized.has(normalizeOrderNumber(order.displayName)));
}

export function isVerifiedOrderCandidate(candidateIds: string[], requestedOrderId: string) {
  return Boolean(requestedOrderId) && candidateIds.includes(requestedOrderId);
}

export function hasExplicitCancellationIntent(text: string) {
  return /\b(annuleer|annuleren|annulering|cancel(?: my| the)? order|cancelen|afzien van (?:de )?bestelling)\b/i.test(text);
}

export function cancellationActionFingerprint(input: {
  tenantId: string;
  conversationId: string;
  sourceMessageId: string;
  externalOrderId: string;
}) {
  return crypto.createHash("sha256")
    .update(`${input.tenantId}:${input.conversationId}:${input.sourceMessageId}:${input.externalOrderId}:cancel_order`)
    .digest("hex");
}
