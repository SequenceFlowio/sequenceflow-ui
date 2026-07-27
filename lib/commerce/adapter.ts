import type { CommerceAdapter, CommerceConnection } from "@/lib/commerce/types";
import { ShopifyAdapter } from "@/lib/commerce/shopify";
import { WooCommerceAdapter } from "@/lib/commerce/woocommerce";
import { BolAdapter } from "@/lib/commerce/bol";
import { commerceProviderDefinition } from "@/lib/commerce/providers";

export function commerceAdapterFor(connection: CommerceConnection): CommerceAdapter {
  if (connection.provider === "bol") return new BolAdapter();
  if (connection.provider === "woocommerce") return new WooCommerceAdapter();
  return new ShopifyAdapter();
}

export function commercePermissionIssue(connection: CommerceConnection) {
  if (!commerceProviderDefinition(connection.provider).actionsAllowed) {
    return `${commerceProviderDefinition(connection.provider).label} actions are disabled.`;
  }
  const required = ["read_orders", "write_orders"];
  const missing = required.filter((scope) => !connection.scopes.includes(scope));
  return missing.length ? `Missing commerce permissions: ${missing.join(", ")}.` : null;
}
