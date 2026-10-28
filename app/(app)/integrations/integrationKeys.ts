/** De koppelingen die /integrations?koppeling=… kan openen. Gedeeld door server en client. */
export const INTEGRATION_KEYS = ["mail", "bol", "shopify", "woocommerce", "ai"] as const;
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number];

export function isIntegrationKey(value: string): value is IntegrationKey {
  return (INTEGRATION_KEYS as readonly string[]).includes(value);
}
