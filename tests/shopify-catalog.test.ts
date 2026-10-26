import assert from "node:assert/strict";
import test from "node:test";
import { applyShopifyVariants, shopifyOrderVariantsQuery } from "../lib/commerce/shopifyCatalog.ts";
import { shopifyCatalogAccess } from "../lib/commerce/shopifyAuth.ts";
import type { NormalizedCommerceOrder } from "../lib/commerce/types.ts";

const order: NormalizedCommerceOrder = {
  externalId: "gid://shopify/Order/1", displayName: "#1001", customerEmail: "klant@example.com",
  financialStatus: "PAID", fulfillmentStatus: "UNFULFILLED", totalAmount: 50, currencyCode: "EUR",
  cancelable: true, cancelledAt: null, createdAt: "2026-10-01T10:00:00Z", updatedAt: null, fulfillments: [],
  items: [
    { externalId: "gid://shopify/LineItem/1", productExternalId: null, variantExternalId: null, sku: "JURK-M", title: "Jurk", variantTitle: "M / Groen", quantity: 1 },
    { externalId: "gid://shopify/LineItem/2", productExternalId: null, variantExternalId: null, sku: null, title: "Cadeaubon", variantTitle: null, quantity: 1 },
    { externalId: "gid://shopify/LineItem/3", productExternalId: null, variantExternalId: null, sku: null, title: "Verwijderd product", variantTitle: null, quantity: 1 },
  ],
};

const variants = {
  nodes: [{
    id: "gid://shopify/Order/1", currencyCode: "EUR",
    lineItems: { nodes: [
      { id: "gid://shopify/LineItem/1", variant: { id: "gid://shopify/ProductVariant/11", barcode: " 8712345678901 ", price: "49.95", availableForSale: true, inventoryPolicy: "DENY", inventoryQuantity: 4, inventoryItem: { tracked: true } } },
      { id: "gid://shopify/LineItem/2", variant: { id: "gid://shopify/ProductVariant/12", barcode: null, price: "25.00", availableForSale: true, inventoryPolicy: "DENY", inventoryQuantity: 0, inventoryItem: { tracked: false } } },
      { id: "gid://shopify/LineItem/3", variant: null },
    ] },
  }, null],
};

test("catalog access needs read_products; stock also needs read_inventory", () => {
  assert.deepEqual(shopifyCatalogAccess(["read_orders"]), { products: false, inventory: false });
  assert.deepEqual(shopifyCatalogAccess(["read_orders", "read_inventory"]), { products: false, inventory: false });
  assert.deepEqual(shopifyCatalogAccess(["read_orders", "read_products"]), { products: true, inventory: false });
  assert.deepEqual(shopifyCatalogAccess(["read_orders", "read_products", "read_inventory"]), { products: true, inventory: true });
});

test("stock fields are only queried with inventory access", () => {
  assert.doesNotMatch(shopifyOrderVariantsQuery({ products: true, inventory: false }), /inventoryQuantity/);
  assert.match(shopifyOrderVariantsQuery({ products: true, inventory: true }), /inventoryQuantity inventoryItem \{ tracked \}/);
});

test("variants become offers with stock, price and availability", () => {
  const [enriched] = applyShopifyVariants([order], variants, { products: true, inventory: true });
  const [dress, voucher, removed] = enriched.items;
  assert.equal(dress.offerExternalId, "gid://shopify/ProductVariant/11");
  assert.equal(dress.variantExternalId, "gid://shopify/ProductVariant/11");
  assert.equal(dress.ean, "8712345678901");
  assert.deepEqual(dress.offer, { stockAmount: 4, forSale: true, price: 49.95, currencyCode: "EUR" });
  // Untracked stock has no meaningful count.
  assert.equal(voucher.offer?.stockAmount, null);
  assert.equal(voucher.ean, null);
  // A deleted product keeps the order line as it was.
  assert.deepEqual(removed, order.items[2]);
});

test("without inventory access no stock count is stored", () => {
  const [enriched] = applyShopifyVariants([order], variants, { products: true, inventory: false });
  assert.equal(enriched.items[0].offer?.stockAmount, null);
  assert.equal(enriched.items[0].offer?.forSale, true);
});

test("overselling variants report no stock count", () => {
  const overselling = structuredClone(variants);
  overselling.nodes[0]!.lineItems.nodes[0].variant!.inventoryPolicy = "CONTINUE";
  const [enriched] = applyShopifyVariants([order], overselling, { products: true, inventory: true });
  assert.equal(enriched.items[0].offer?.stockAmount, null);
});

test("orders missing from the response are returned unchanged", () => {
  assert.deepEqual(applyShopifyVariants([order], { nodes: [] }, { products: true, inventory: true }), [order]);
});
