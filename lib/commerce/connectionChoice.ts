/**
 * Which store connection answers for an inbound email when a workspace has
 * more than one (for example bol and Shopify). Pure, so it is unit-tested.
 *
 * - A recognised bol mail belongs to bol.
 * - Any other mail comes from the merchant's own shop (Shopify, WooCommerce):
 *   bol customers cannot mail the shop directly, so bol is only the fallback.
 */
export function chooseCommerceConnection<T extends { provider: string }>(connections: T[], mail: { recognizedBolMail: boolean }): T | null {
  if (!connections.length) return null;
  const bol = connections.find((connection) => connection.provider === "bol");
  const ownShop = connections.find((connection) => connection.provider !== "bol");
  if (mail.recognizedBolMail) return bol ?? ownShop ?? null;
  return ownShop ?? bol ?? null;
}
