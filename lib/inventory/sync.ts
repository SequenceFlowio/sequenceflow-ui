import { loadActiveCommerceConnections } from "@/lib/commerce/connections";
import { listShopifyInventoryVariants } from "@/lib/commerce/shopify";
import type { CommerceConnection } from "@/lib/commerce/types";
import { listWooInventoryVariants } from "@/lib/commerce/woocommerce";
import { mapBolOffer, wooVariationExternalId, type BolOfferSnapshot, type CatalogRow } from "@/lib/inventory/catalogCore";
import {
  DEFAULT_INVENTORY_SETTINGS,
  addDays,
  aggregateDailySales,
  combineStock,
  createVariantResolver,
  detectDeliveries,
  seasonReport,
  shopDay,
  type InventorySettings,
  type OrderForRollup,
} from "@/lib/inventory/core";
import type { QuestionConversation } from "@/lib/inventory/questionsCore";
import { buildHistories, buildReport, historyWindowStart, type InventoryReport, type VariantRow } from "@/lib/inventory/reportCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Keeps the inkoopadvies data up to date for one workspace: catalog per
 * channel, daily sales per variant (rebuilt from the orders we still have),
 * today's stock, detected deliveries, and the cached report.
 */

/** Orders are kept 90 days; the first sync reads all of them, later syncs the last two weeks. */
const FIRST_ROLLUP_DAYS = 89;
const ROLLUP_DAYS = 14;
const PAGE = 1000;
const ORDER_CHANNELS = ["shopify", "woocommerce", "bol"] as const;

export function inventoryAdviceEnabled() {
  return process.env.NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED === "true";
}

type SettingsRow = {
  lead_time_days: number; cover_weeks: number; safety_buffer: number | string; dead_after_days: number; dead_cover_weeks: number;
  weekly_email: boolean; last_synced_at: string | null; last_sync_error: string | null; last_email_sent_at: string | null;
  report: InventoryReport | null; report_built_at: string | null;
};

export type InventorySettingsState = InventorySettings & {
  weeklyEmail: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  lastEmailSentAt: string | null;
};

function mapSettings(row: Partial<SettingsRow> | null): InventorySettingsState {
  return {
    leadTimeDays: row?.lead_time_days ?? DEFAULT_INVENTORY_SETTINGS.leadTimeDays,
    coverWeeks: row?.cover_weeks ?? DEFAULT_INVENTORY_SETTINGS.coverWeeks,
    safetyBuffer: row?.safety_buffer != null ? Number(row.safety_buffer) : DEFAULT_INVENTORY_SETTINGS.safetyBuffer,
    deadAfterDays: row?.dead_after_days ?? DEFAULT_INVENTORY_SETTINGS.deadAfterDays,
    deadCoverWeeks: row?.dead_cover_weeks ?? DEFAULT_INVENTORY_SETTINGS.deadCoverWeeks,
    weeklyEmail: row?.weekly_email ?? false,
    lastSyncedAt: row?.last_synced_at ?? null,
    lastSyncError: row?.last_sync_error ?? null,
    lastEmailSentAt: row?.last_email_sent_at ?? null,
  };
}

export async function loadInventorySettings(tenantId: string) {
  const { data, error } = await getSupabaseAdmin().from("inventory_settings")
    .select("lead_time_days,cover_weeks,safety_buffer,dead_after_days,dead_cover_weeks,weekly_email,last_synced_at,last_sync_error,last_email_sent_at")
    .eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new Error(`Could not load inventory settings: ${error.message}`);
  return mapSettings(data);
}

export async function loadCachedInventoryReport(tenantId: string) {
  const { data, error } = await getSupabaseAdmin().from("inventory_settings")
    .select("report").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new Error(`Could not load inventory report: ${error.message}`);
  return (data?.report as InventoryReport | null) ?? null;
}

/** All rows of a query, a thousand at a time (PostgREST returns at most 1000 per request). */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

// ── Catalog ─────────────────────────────────────────────────────────────────

async function bolCatalog(connection: CommerceConnection) {
  const db = getSupabaseAdmin();
  const offers = await fetchAll<BolOfferSnapshot & { last_synced_at: string }>((from, to) => db.from("commerce_offer_snapshots")
    .select("external_id,ean,fulfilment_method,stock_amount,corrected_stock,price,currency_code,for_sale,last_synced_at")
    .eq("tenant_id", connection.tenantId).eq("connection_id", connection.id).eq("provider", "bol")
    .order("last_synced_at", { ascending: false }).range(from, to));
  const latest = new Map<string, BolOfferSnapshot>();
  for (const offer of offers) if (!latest.has(offer.external_id)) latest.set(offer.external_id, offer);
  if (!latest.size) return { complete: false, rows: [] as CatalogRow[] };
  const items = await fetchAll<{ offer_external_id: string | null; title: string; variant_title: string | null }>((from, to) => db.from("commerce_order_items")
    .select("offer_external_id,title,variant_title").eq("tenant_id", connection.tenantId)
    .in("offer_external_id", [...latest.keys()].slice(0, 500)).range(from, to));
  const titles = new Map(items.filter((item) => item.offer_external_id).map((item) => [item.offer_external_id!, { productTitle: item.title, variantTitle: item.variant_title }]));
  // bol.com offers without orders are unknown here; they are kept from earlier syncs, never archived.
  return { complete: false, rows: [...latest.values()].map((offer) => mapBolOffer(offer, titles.get(offer.external_id) ?? null)) };
}

async function catalogFor(connection: CommerceConnection) {
  if (connection.provider === "shopify") return listShopifyInventoryVariants(connection);
  if (connection.provider === "woocommerce") return listWooInventoryVariants(connection);
  return bolCatalog(connection);
}

async function saveCatalog(connection: CommerceConnection, rows: CatalogRow[], complete: boolean, syncedAt: string) {
  const db = getSupabaseAdmin();
  const unique = [...new Map(rows.map((row) => [row.externalId, row])).values()];
  for (let start = 0; start < unique.length; start += 500) {
    const { error } = await db.from("inventory_variants").upsert(unique.slice(start, start + 500).map((row) => ({
      tenant_id: connection.tenantId,
      connection_id: connection.id,
      provider: row.provider,
      external_id: row.externalId,
      variant_key: row.variantKey,
      product_external_id: row.productExternalId,
      product_title: row.productTitle,
      variant_title: row.variantTitle,
      sku: row.sku,
      ean: row.ean,
      options: row.options,
      price: row.price,
      unit_cost: row.unitCost,
      currency_code: row.currencyCode,
      stock: row.stock,
      stock_tracked: row.stockTracked,
      own_warehouse: row.ownWarehouse,
      status: row.status,
      last_synced_at: syncedAt,
      updated_at: syncedAt,
    })), { onConflict: "tenant_id,provider,external_id" });
    if (error) throw new Error(`Could not save the catalog: ${error.message}`);
  }
  // A complete listing tells us which variants no longer exist.
  if (complete) {
    const { error } = await db.from("inventory_variants").update({ status: "archived", updated_at: syncedAt })
      .eq("tenant_id", connection.tenantId).eq("connection_id", connection.id).lt("last_synced_at", syncedAt);
    if (error) throw new Error(`Could not archive removed variants: ${error.message}`);
  }
  return unique.length;
}

async function loadVariants(tenantId: string) {
  const db = getSupabaseAdmin();
  return fetchAll<VariantRow>((from, to) => db.from("inventory_variants")
    .select("provider,external_id,variant_key,product_external_id,product_title,variant_title,sku,ean,options,price,unit_cost,stock,stock_tracked,own_warehouse,status,first_seen_at")
    .eq("tenant_id", tenantId).order("id").range(from, to));
}

// ── Daily sales and stock ───────────────────────────────────────────────────

type OrderItemRow = {
  variant_external_id: string | null; product_external_id: string | null; offer_external_id: string | null;
  sku: string | null; ean: string | null; title: string; variant_title: string | null; quantity: number; unit_price: number | string | null;
};

async function rollupSales(tenantId: string, variants: VariantRow[], sinceDay: string, syncedAt: string) {
  const db = getSupabaseAdmin();
  // A day early in UTC, so the first Amsterdam day is complete; filtered by shop day below.
  const orders = await fetchAll<{ provider: OrderForRollup["provider"]; order_created_at: string; cancelled_at: string | null; commerce_order_items: OrderItemRow[] }>((from, to) => db.from("commerce_orders")
    .select("provider,order_created_at,cancelled_at,commerce_order_items(variant_external_id,product_external_id,offer_external_id,sku,ean,title,variant_title,quantity,unit_price)")
    .eq("tenant_id", tenantId).gte("order_created_at", `${addDays(sinceDay, -1)}T00:00:00Z`).order("id").range(from, to));
  const resolve = createVariantResolver(variants.map((row) => ({ variantKey: row.variant_key, provider: row.provider, externalId: row.external_id, sku: row.sku, ean: row.ean })));
  const prices = new Map(variants.filter((row) => row.price != null).map((row) => [row.variant_key, Number(row.price)]));
  const rows = aggregateDailySales(orders.map((order) => ({
    provider: order.provider,
    createdAt: order.order_created_at,
    cancelledAt: order.cancelled_at,
    items: (order.commerce_order_items ?? []).map((item) => ({
      provider: order.provider,
      variantExternalId: order.provider === "woocommerce" ? wooVariationExternalId(item.product_external_id, item.variant_external_id) : item.variant_external_id,
      offerExternalId: item.offer_external_id,
      sku: item.sku,
      ean: item.ean,
      title: item.title,
      variantTitle: item.variant_title,
      quantity: item.quantity,
      unitPrice: item.unit_price == null ? null : Number(item.unit_price),
    })),
  })), resolve, (key) => prices.get(key) ?? null).filter((row) => row.day >= sinceDay);

  for (let start = 0; start < rows.length; start += 1000) {
    const { error } = await db.from("inventory_daily_sales").upsert(rows.slice(start, start + 1000).map((row) => ({
      tenant_id: tenantId, variant_key: row.variantKey, day: row.day, channel: row.channel,
      units_sold: row.unitsSold, revenue: row.revenue, orders: row.orders, updated_at: syncedAt,
    })), { onConflict: "tenant_id,variant_key,day,channel" });
    if (error) throw new Error(`Could not save daily sales: ${error.message}`);
  }
  // Days in the window whose orders were cancelled or moved: rows this run did not write.
  const { error } = await db.from("inventory_daily_sales").delete()
    .eq("tenant_id", tenantId).gte("day", sinceDay).in("channel", [...ORDER_CHANNELS]).lt("updated_at", syncedAt);
  if (error) throw new Error(`Could not clean up daily sales: ${error.message}`);
  return rows.length;
}

async function snapshotStock(tenantId: string, variants: VariantRow[], today: string) {
  const stock = combineStock(variants.map((row) => ({
    variantKey: row.variant_key, provider: row.provider, stock: row.stock, stockTracked: row.stock_tracked, ownWarehouse: row.own_warehouse, status: row.status,
  })));
  const rows = [...stock].filter(([, value]) => value != null).map(([variantKey, value]) => ({ tenant_id: tenantId, variant_key: variantKey, day: today, stock: value! }));
  for (let start = 0; start < rows.length; start += 1000) {
    const { error } = await getSupabaseAdmin().from("inventory_daily_stock").upsert(rows.slice(start, start + 1000), { onConflict: "tenant_id,variant_key,day" });
    if (error) throw new Error(`Could not save today's stock: ${error.message}`);
  }
  return rows.length;
}

async function saveDetectedDeliveries(tenantId: string, today: string) {
  const db = getSupabaseAdmin();
  const since = addDays(today, -3);
  const [stock, sales] = await Promise.all([
    fetchAll<{ variant_key: string; day: string; stock: number }>((from, to) => db.from("inventory_daily_stock")
      .select("variant_key,day,stock").eq("tenant_id", tenantId).gte("day", since).order("day").range(from, to)),
    fetchAll<{ variant_key: string; day: string; units_sold: number }>((from, to) => db.from("inventory_daily_sales")
      .select("variant_key,day,units_sold").eq("tenant_id", tenantId).gte("day", since).order("day").range(from, to)),
  ]);
  const stockByKey = new Map<string, Map<string, number>>();
  for (const row of stock) stockByKey.set(row.variant_key, (stockByKey.get(row.variant_key) ?? new Map()).set(row.day, row.stock));
  const salesByKey = new Map<string, Map<string, number>>();
  for (const row of sales) {
    const series = salesByKey.get(row.variant_key) ?? new Map<string, number>();
    series.set(row.day, (series.get(row.day) ?? 0) + row.units_sold);
    salesByKey.set(row.variant_key, series);
  }
  const deliveries = [...stockByKey].flatMap(([variantKey, series]) => detectDeliveries(series, salesByKey.get(variantKey) ?? new Map())
    .map((delivery) => ({ tenant_id: tenantId, variant_key: variantKey, received_on: delivery.day, quantity: delivery.quantity, source: "detected" })));
  if (deliveries.length) {
    const { error } = await db.from("inventory_deliveries").upsert(deliveries, { onConflict: "tenant_id,variant_key,received_on,source", ignoreDuplicates: true });
    if (error) throw new Error(`Could not save deliveries: ${error.message}`);
  }
  return deliveries.length;
}

// ── Customer questions ──────────────────────────────────────────────────────

/** Conversations kept as long as orders: questions are counted over the same 90 days. */
const QUESTION_DAYS = 90;
/** Enough for a busy shop; the newest conversations count first. */
const QUESTION_CONVERSATIONS_MAX = 3000;
const QUESTION_TEXT_MAX = 1500;
const ID_BATCH = 200;

function batches<T>(items: T[], size = ID_BATCH) {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += size) out.push(items.slice(start, start + size));
  return out;
}

/**
 * The last 90 days of real customer conversations, reduced to what the
 * question count needs: the customer's first message, the detected intent and
 * the variants on a linked order. Nothing of this is stored.
 */
async function loadQuestionConversations(tenantId: string, variants: VariantRow[], today: string): Promise<QuestionConversation[]> {
  const db = getSupabaseAdmin();
  const conversations: Array<{ id: string; subject_original: string | null }> = [];
  for (let from = 0; conversations.length < QUESTION_CONVERSATIONS_MAX; from += PAGE) {
    const { data, error } = await db.from("support_conversations")
      .select("id,subject_original")
      .eq("tenant_id", tenantId)
      .gte("created_at", `${addDays(today, -QUESTION_DAYS)}T00:00:00Z`)
      .not("status", "in", "(spam,ignored)")
      .not("customer_email", "ilike", "*.invalid")
      .order("created_at", { ascending: false }).order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load conversations: ${error.message}`);
    conversations.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  if (!conversations.length) return [];
  const ids = conversations.slice(0, QUESTION_CONVERSATIONS_MAX).map((row) => row.id);

  const firstMessage = new Map<string, string>();
  const intent = new Map<string, string | null>();
  const orderIds = new Map<string, string[]>();
  for (const chunk of batches(ids)) {
    const [messages, decisions, links] = await Promise.all([
      fetchAll<{ conversation_id: string; body_original: string | null }>((from, to) => db.from("support_messages")
        .select("conversation_id,body_original").eq("tenant_id", tenantId).eq("direction", "inbound").in("conversation_id", chunk)
        .order("created_at").order("id").range(from, to)),
      fetchAll<{ conversation_id: string; intent: string | null }>((from, to) => db.from("support_decisions")
        .select("conversation_id,intent").eq("tenant_id", tenantId).in("conversation_id", chunk)
        .order("created_at", { ascending: false }).order("id").range(from, to)),
      fetchAll<{ conversation_id: string; order_id: string }>((from, to) => db.from("conversation_entity_links")
        .select("conversation_id,order_id").eq("tenant_id", tenantId).eq("link_status", "linked").in("conversation_id", chunk)
        .order("id").range(from, to)),
    ]);
    for (const message of messages) if (!firstMessage.has(message.conversation_id)) firstMessage.set(message.conversation_id, (message.body_original ?? "").slice(0, QUESTION_TEXT_MAX));
    for (const decision of decisions) if (!intent.has(decision.conversation_id)) intent.set(decision.conversation_id, decision.intent);
    for (const link of links) orderIds.set(link.conversation_id, [...(orderIds.get(link.conversation_id) ?? []), link.order_id]);
  }

  const resolve = createVariantResolver(variants.map((row) => ({ variantKey: row.variant_key, provider: row.provider, externalId: row.external_id, sku: row.sku, ean: row.ean })));
  const orderVariants = new Map<string, string[]>();
  for (const chunk of batches([...new Set([...orderIds.values()].flat())])) {
    const orders = await fetchAll<{ id: string; provider: OrderForRollup["provider"]; commerce_order_items: OrderItemRow[] }>((from, to) => db.from("commerce_orders")
      .select("id,provider,commerce_order_items(variant_external_id,product_external_id,offer_external_id,sku,ean,title,variant_title,quantity,unit_price)")
      .eq("tenant_id", tenantId).in("id", chunk).order("id").range(from, to));
    for (const order of orders) {
      orderVariants.set(order.id, (order.commerce_order_items ?? []).map((item) => resolve({
        provider: order.provider,
        variantExternalId: order.provider === "woocommerce" ? wooVariationExternalId(item.product_external_id, item.variant_external_id) : item.variant_external_id,
        offerExternalId: item.offer_external_id,
        sku: item.sku,
        ean: item.ean,
        title: item.title,
        variantTitle: item.variant_title,
      })));
    }
  }

  return conversations.slice(0, QUESTION_CONVERSATIONS_MAX).map((row) => ({
    id: row.id,
    text: `${row.subject_original ?? ""}\n${firstMessage.get(row.id) ?? ""}`,
    intent: intent.get(row.id) ?? null,
    orderVariantKeys: (orderIds.get(row.id) ?? []).flatMap((orderId) => orderVariants.get(orderId) ?? []),
  }));
}

// ── Report ──────────────────────────────────────────────────────────────────

/** Everything stored for the report: catalog, sales history, recent stock, deliveries and returns. */
async function loadInventoryInputs(tenantId: string, today: string, withQuestions = true) {
  const db = getSupabaseAdmin();
  const [settings, variants, sales, stock, deliveries, returns] = await Promise.all([
    loadInventorySettings(tenantId),
    loadVariants(tenantId),
    fetchAll<{ variant_key: string; day: string; channel: string; units_sold: number; revenue: number | string }>((from, to) => db.from("inventory_daily_sales")
      .select("variant_key,day,channel,units_sold,revenue").eq("tenant_id", tenantId).gte("day", historyWindowStart(today)).order("day").order("variant_key").order("channel").range(from, to)),
    fetchAll<{ variant_key: string; day: string; stock: number }>((from, to) => db.from("inventory_daily_stock")
      .select("variant_key,day,stock").eq("tenant_id", tenantId).gte("day", addDays(today, -120)).order("day").order("variant_key").range(from, to)),
    fetchAll<{ id: string; variant_key: string; received_on: string; quantity: number; source: string; note: string | null }>((from, to) => db.from("inventory_deliveries")
      .select("id,variant_key,received_on,quantity,source,note").eq("tenant_id", tenantId).gte("received_on", addDays(today, -400)).order("received_on").order("id").range(from, to)),
    fetchAll<{ ean: string | null; reason: string | null; expected_quantity: number }>((from, to) => db.from("commerce_return_items")
      .select("ean,reason,expected_quantity").eq("tenant_id", tenantId).gte("created_at", `${addDays(today, -365)}T00:00:00Z`).order("id").range(from, to)),
  ]);
  // Questions are a bonus on top of stock and sales: if they cannot be read, the report still comes.
  const conversations = !withQuestions ? [] : await loadQuestionConversations(tenantId, variants, today).catch((error) => {
    console.error("[inventory/questions]", error instanceof Error ? error.message : error);
    return [] as QuestionConversation[];
  });
  return {
    settings,
    variants,
    sales,
    stock,
    deliveries,
    returns: returns.map((row) => ({ ean: row.ean, reason: row.reason, quantity: Math.max(1, row.expected_quantity) })),
    conversations,
    today,
  };
}

/** Recomputes the report from everything stored and caches it on the settings row. */
export async function rebuildInventoryReport(tenantId: string, now = new Date()) {
  const db = getSupabaseAdmin();
  const inputs = await loadInventoryInputs(tenantId, shopDay(now));
  const report = buildReport({ ...inputs, builtAt: now.toISOString() });
  const { error } = await db.from("inventory_settings").upsert({ tenant_id: tenantId, report, report_built_at: report.builtAt, updated_at: report.builtAt }, { onConflict: "tenant_id" });
  if (error) throw new Error(`Could not save the report: ${error.message}`);
  return report;
}

// ── Everything for one workspace ────────────────────────────────────────────

export type InventorySyncResult = {
  connections: Array<{ provider: string; variants: number; complete: boolean; skipped?: string; error?: string }>;
  salesRows: number;
  stockRows: number;
  deliveries: number;
  report: InventoryReport;
};

export async function syncInventory(tenantId: string, now = new Date()): Promise<InventorySyncResult> {
  const db = getSupabaseAdmin();
  const syncedAt = now.toISOString();
  const today = shopDay(now);
  const settings = await loadInventorySettings(tenantId);
  const results: InventorySyncResult["connections"] = [];
  try {
    for (const connection of await loadActiveCommerceConnections(tenantId)) {
      try {
        const catalog = await catalogFor(connection);
        if (!catalog) {
          results.push({ provider: connection.provider, variants: 0, complete: false, skipped: "no_product_access" });
          continue;
        }
        results.push({ provider: connection.provider, variants: await saveCatalog(connection, catalog.rows, catalog.complete, syncedAt), complete: catalog.complete });
      } catch (error) {
        // One channel failing must not stop the others; the report notes it.
        results.push({ provider: connection.provider, variants: 0, complete: false, error: error instanceof Error ? error.message.slice(0, 300) : "failed" });
      }
    }
    const variants = await loadVariants(tenantId);
    const sinceDay = addDays(today, -(settings.lastSyncedAt ? ROLLUP_DAYS : FIRST_ROLLUP_DAYS));
    const salesRows = await rollupSales(tenantId, variants, sinceDay, syncedAt);
    const stockRows = await snapshotStock(tenantId, variants, today);
    const deliveries = await saveDetectedDeliveries(tenantId, today);
    const failed = results.filter((result) => result.error);
    const { error } = await db.from("inventory_settings").upsert({
      tenant_id: tenantId,
      last_synced_at: syncedAt,
      last_sync_error: failed.length ? failed.map((result) => `${result.provider}: ${result.error}`).join(" · ").slice(0, 1000) : null,
      updated_at: syncedAt,
    }, { onConflict: "tenant_id" });
    if (error) throw new Error(error.message);
    const report = await rebuildInventoryReport(tenantId, now);
    return { connections: results, salesRows, stockRows, deliveries, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory sync failed.";
    await db.from("inventory_settings").upsert({ tenant_id: tenantId, last_sync_error: message.slice(0, 1000), updated_at: syncedAt }, { onConflict: "tenant_id" });
    throw error;
  }
}

/** What sold between `from` and `to` one year earlier (for buying ahead of a season). */
export async function loadSeasonReport(tenantId: string, from: string, to: string, now = new Date()) {
  const inputs = await loadInventoryInputs(tenantId, shopDay(now), false);
  return seasonReport(buildHistories(inputs), from, to);
}
