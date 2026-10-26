import type { NormalizedCommerceOrder } from "./types.ts";

export type ShopifyCatalogAccess = { products: boolean; inventory: boolean };

type VariantNode = {
  id: string;
  barcode?: string | null;
  price?: string | null;
  availableForSale?: boolean | null;
  inventoryPolicy?: string | null;
  inventoryQuantity?: number | null;
  inventoryItem?: { tracked?: boolean | null } | null;
};

export type ShopifyOrderVariants = {
  nodes: Array<{
    id?: string;
    currencyCode?: string | null;
    lineItems?: { nodes?: Array<{ id: string; variant?: VariantNode | null }> };
  } | null>;
};

/**
 * Variant details for the first 20 line items, in one request per batch of orders. Stock
 * fields are only requested when the shop granted read_inventory.
 */
export function shopifyOrderVariantsQuery(access: ShopifyCatalogAccess) {
  const stock = access.inventory ? " inventoryPolicy inventoryQuantity inventoryItem { tracked }" : "";
  return `query OrderVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id currencyCode
        lineItems(first: 20) { nodes { id variant { id barcode price availableForSale${stock} } } }
      }
    }
  }`;
}

/**
 * Copies variant details onto the order items: the variant becomes the offer
 * (like a bol.com offer), so the stored snapshot feeds the same stock context.
 */
export function applyShopifyVariants(orders: NormalizedCommerceOrder[], data: ShopifyOrderVariants, access: ShopifyCatalogAccess) {
  const byOrder = new Map(data.nodes.filter((node) => node?.id).map((node) => [node!.id!, node!]));
  return orders.map((order) => {
    const details = byOrder.get(order.externalId);
    if (!details) return order;
    const variants = new Map((details.lineItems?.nodes ?? []).map((line) => [line.id, line.variant ?? null]));
    return {
      ...order,
      items: order.items.map((item) => {
        const variant = variants.get(item.externalId);
        if (!variant?.id) return item;
        const price = Number(variant.price);
        // An untracked variant, or one that may be sold out of stock, has no meaningful count.
        const counted = access.inventory && variant.inventoryItem?.tracked !== false && variant.inventoryPolicy !== "CONTINUE";
        return {
          ...item,
          variantExternalId: variant.id,
          offerExternalId: variant.id,
          ean: variant.barcode?.trim() || item.ean || null,
          offer: {
            stockAmount: counted && Number.isFinite(variant.inventoryQuantity) ? Number(variant.inventoryQuantity) : null,
            forSale: typeof variant.availableForSale === "boolean" ? variant.availableForSale : null,
            price: variant.price != null && Number.isFinite(price) ? price : null,
            currencyCode: details.currencyCode || order.currencyCode,
          },
        };
      }),
    };
  });
}
