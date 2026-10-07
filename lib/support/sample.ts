/**
 * Example questions ("Try an example" in the Shopify app) come from a fixed,
 * undeliverable address (.invalid is reserved and never resolves). That keeps
 * them away from real customers: they are never sent, never billed and never
 * count as a repeat contact.
 */
export const SAMPLE_CUSTOMER_EMAIL = "voorbeeld@sample.invalid";

export function isSampleAddress(email: string | null | undefined) {
  return /@([a-z0-9-]+\.)*invalid$/i.test(email?.trim() ?? "");
}
