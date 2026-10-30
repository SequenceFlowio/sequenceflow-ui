import { normalizeEan, normalizeSku, variantKeyFor } from "./core.ts";

/**
 * Turns each platform's product data into catalog rows (inventory_variants).
 * Pure, so the mapping of every platform is tested without network access.
 */

export type CatalogRow = {
  provider: "shopify" | "woocommerce" | "bol" | "manual";
  externalId: string;
  variantKey: string;
  productExternalId: string | null;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  ean: string | null;
  options: Record<string, string>;
  price: number | null;
  unitCost: number | null;
  currencyCode: string;
  stock: number | null;
  stockTracked: boolean;
  ownWarehouse: boolean;
  status: "active" | "archived";
};

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clean(value: unknown, max = 300) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return text ? text.slice(0, max) : null;
}

function isDefaultTitle(value: string | null) {
  return !value || /^default( title)?$/i.test(value);
}

// ── Shopify ─────────────────────────────────────────────────────────────────

export type ShopifyVariantNode = {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  title?: string | null;
  price?: string | null;
  inventoryQuantity?: number | null;
  inventoryItem?: { tracked?: boolean | null; unitCost?: { amount?: string | null } | null } | null;
  selectedOptions?: Array<{ name: string; value: string }> | null;
  product?: { id: string; title?: string | null; status?: string | null } | null;
};

export function shopifyVariantsQuery(withStock: boolean, withCost: boolean) {
  const stock = withStock ? " inventoryQuantity inventoryItem { tracked" + (withCost ? " unitCost { amount }" : "") + " }" : "";
  return `query InventoryVariants($after: String) {
    productVariants(first: 100, after: $after) {
      nodes { id sku barcode title price${stock} selectedOptions { name value } product { id title status } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
}

export function mapShopifyVariant(node: ShopifyVariantNode, currencyCode: string, withStock: boolean): CatalogRow {
  const variantTitle = clean(node.title);
  const options = Object.fromEntries((node.selectedOptions ?? [])
    .filter((option) => option.name && option.value && !/^title$/i.test(option.name))
    .map((option) => [option.name.slice(0, 60), option.value.slice(0, 120)]));
  const tracked = withStock && node.inventoryItem?.tracked !== false && node.inventoryQuantity != null;
  return {
    provider: "shopify",
    externalId: node.id,
    variantKey: variantKeyFor({ sku: node.sku, ean: node.barcode, provider: "shopify", externalId: node.id }),
    productExternalId: node.product?.id ?? null,
    productTitle: clean(node.product?.title) ?? "Product",
    variantTitle: isDefaultTitle(variantTitle) ? null : variantTitle,
    sku: normalizeSku(node.sku),
    ean: normalizeEan(node.barcode),
    options,
    price: toNumber(node.price),
    unitCost: toNumber(node.inventoryItem?.unitCost?.amount),
    currencyCode,
    stock: tracked ? Math.trunc(Number(node.inventoryQuantity)) : null,
    stockTracked: tracked,
    ownWarehouse: true,
    status: node.product?.status && node.product.status !== "ACTIVE" ? "archived" : "active",
  };
}

// ── WooCommerce ─────────────────────────────────────────────────────────────

export type WooProduct = {
  id: number;
  name?: string;
  type?: string;
  status?: string;
  sku?: string | null;
  price?: string | null;
  manage_stock?: boolean | "parent";
  stock_quantity?: number | null;
  attributes?: Array<{ name?: string; option?: string; options?: string[] }>;
  meta_data?: Array<{ key?: string; value?: unknown }>;
  global_unique_id?: string | null;
};

/** Cost price plugins store it as meta; the common keys are read when present. */
function wooCost(item: WooProduct) {
  const meta = item.meta_data?.find((entry) => entry.key && ["_wc_cog_cost", "_cost_price", "_purchase_price", "_alg_wc_cog_cost"].includes(entry.key));
  return toNumber(meta?.value);
}

function wooEan(item: WooProduct) {
  const meta = item.meta_data?.find((entry) => entry.key && ["_ean", "_global_unique_id", "_alg_ean", "_wpm_gtin_code"].includes(entry.key));
  return normalizeEan(item.global_unique_id) ?? normalizeEan(typeof meta?.value === "string" ? meta.value : null);
}

function wooRow(item: WooProduct, parent: WooProduct | null, currencyCode: string): CatalogRow {
  const options = Object.fromEntries((item.attributes ?? [])
    .filter((attribute) => attribute.name && attribute.option)
    .map((attribute) => [attribute.name!.slice(0, 60), attribute.option!.slice(0, 120)]));
  const managesStock = item.manage_stock === true || (item.manage_stock === "parent" && parent?.manage_stock === true);
  const stock = item.manage_stock === "parent" ? parent?.stock_quantity : item.stock_quantity;
  const externalId = parent ? `${parent.id}:${item.id}` : String(item.id);
  return {
    provider: "woocommerce",
    externalId,
    variantKey: variantKeyFor({ sku: item.sku || null, ean: wooEan(item), provider: "woocommerce", externalId: String(item.id) }),
    productExternalId: String(parent?.id ?? item.id),
    productTitle: clean(parent?.name ?? item.name) ?? "Product",
    variantTitle: parent ? (Object.values(options).join(" / ") || clean(item.name)) : null,
    sku: normalizeSku(item.sku),
    ean: wooEan(item),
    options,
    price: toNumber(item.price),
    unitCost: wooCost(item) ?? (parent ? wooCost(parent) : null),
    currencyCode,
    stock: managesStock && stock != null ? Math.trunc(Number(stock)) : null,
    stockTracked: managesStock && stock != null,
    ownWarehouse: true,
    status: (parent?.status ?? item.status) === "publish" || (parent?.status ?? item.status) === "private" ? "active" : "archived",
  };
}

export function mapWooProduct(product: WooProduct, variations: WooProduct[], currencyCode: string) {
  if (product.type === "variable") return variations.map((variation) => wooRow(variation, product, currencyCode));
  return [wooRow(product, null, currencyCode)];
}

/** WooCommerce order lines name the variation by its own id; catalog rows use parent:variation. */
export function wooVariationExternalId(productId: string | null, variationId: string | null) {
  return variationId && productId ? `${productId}:${variationId}` : productId;
}

// ── bol.com ─────────────────────────────────────────────────────────────────

export type BolOfferSnapshot = {
  external_id: string;
  ean: string | null;
  fulfilment_method: string | null;
  stock_amount: number | null;
  corrected_stock: number | null;
  price: number | null;
  currency_code: string | null;
  for_sale: boolean | null;
};

/**
 * bol.com offers seen in orders. LVB (FBB) stock sits in bol.com's warehouse
 * and is counted on top of the webshop; FBR stock is the shop's own warehouse.
 */
export function mapBolOffer(offer: BolOfferSnapshot, title: { productTitle: string; variantTitle: string | null } | null): CatalogRow {
  const lvb = offer.fulfilment_method === "FBB";
  const stock = offer.corrected_stock ?? offer.stock_amount;
  return {
    provider: "bol",
    externalId: offer.external_id,
    variantKey: variantKeyFor({ ean: offer.ean, provider: "bol", externalId: offer.external_id }),
    productExternalId: null,
    productTitle: title?.productTitle ?? `EAN ${offer.ean ?? offer.external_id}`,
    variantTitle: title?.variantTitle ?? null,
    sku: null,
    ean: normalizeEan(offer.ean),
    options: {},
    price: toNumber(offer.price),
    unitCost: null,
    currencyCode: offer.currency_code || "EUR",
    stock: stock == null ? null : Math.trunc(Number(stock)),
    stockTracked: stock != null,
    ownWarehouse: !lvb,
    status: offer.for_sale === false && !stock ? "archived" : "active",
  };
}
