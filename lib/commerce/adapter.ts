import type { CommerceAdapter, CommerceConnection } from "@/lib/commerce/types";
import { ShopifyAdapter } from "@/lib/commerce/shopify";
import { WooCommerceAdapter } from "@/lib/commerce/woocommerce";

export function commerceAdapterFor(connection: CommerceConnection): CommerceAdapter {
  return connection.provider === "woocommerce" ? new WooCommerceAdapter() : new ShopifyAdapter();
}

export function commercePermissionIssue(connection: CommerceConnection) {
  const required = ["read_orders", "write_orders"];
  const missing = required.filter((scope) => !connection.scopes.includes(scope));
  return missing.length ? `Missing commerce permissions: ${missing.join(", ")}.` : null;
}
