import { bolRequest, getBolAccessToken } from "@/lib/commerce/bolHttp";
import {
  normalizeBolOrder,
  type BolOrder,
  type BolReturnItem,
  type BolShipment,
  normalizeBolReturnItem,
} from "@/lib/commerce/bolCore";
import { upsertCommerceOrder } from "@/lib/commerce/repository";
import type {
  CommerceAdapter,
  CommerceConnection,
  NormalizedCommerceOrder,
} from "@/lib/commerce/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type BolReturn = {
  returnId?: string;
  registrationDateTime?: string;
  fulfilmentMethod?: string;
  returnItems?: BolReturnItem[];
};

type BolOffer = {
  offerId?: string;
  ean?: string;
  product?: { bolProductId?: string };
  fulfilment?: { method?: string };
  stock?: { amount?: number; correctedStock?: number };
  pricing?: { bundlePrices?: Array<{ quantity?: number; unitPrice?: number }> };
  price?: number;
  countryAvailabilities?: Array<{ countryCode?: string; forSale?: boolean }>;
};

type BolSubscription = {
  id?: string;
  subscriptionId?: string;
  resources?: string[];
  url?: string;
  enabled?: boolean;
};

type BolProcessStatus = {
  status?: string;
  entityId?: string;
  errorMessage?: string;
};

type BolRetailer = {
  retailerId?: string | number;
  displayName?: string;
};

type BolSignatureKey = {
  id?: string | number;
  publicKey?: string;
};

async function getShipmentsForOrder(connection: CommerceConnection, orderId: string) {
  const list = await bolRequest<{ shipments?: BolShipment[] }>(
    connection,
    `/retailer/shipments?order-id=${encodeURIComponent(orderId)}&page=1`,
  );
  const summaries = list.shipments ?? [];
  return Promise.all(summaries.map(async (shipment) => {
    if (!shipment.shipmentId) return shipment;
    return bolRequest<BolShipment>(connection, `/retailer/shipments/${encodeURIComponent(shipment.shipmentId)}`)
      .catch(() => shipment);
  }));
}

async function getBolOrder(connection: CommerceConnection, orderId: string) {
  try {
    const [order, shipments] = await Promise.all([
      bolRequest<BolOrder>(connection, `/retailer/orders/${encodeURIComponent(orderId)}`),
      getShipmentsForOrder(connection, orderId),
    ]);
    return normalizeBolOrder(order, shipments);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) return null;
    throw error;
  }
}

async function listBolOrderIds(connection: CommerceConnection, query = "") {
  const response = await bolRequest<{ orders?: BolOrder[] }>(
    connection,
    `/retailer/orders?fulfilment-method=ALL&status=ALL&page=1${query}`,
  );
  return (response.orders ?? []).map((order) => order.orderId).filter((id): id is string => Boolean(id));
}

async function persistBolReturns(connection: CommerceConnection) {
  const supabase = getSupabaseAdmin();
  let saved = 0;
  for (const handled of [false, true]) {
    for (let page = 1; page <= 3; page += 1) {
      const payload = await bolRequest<{ returns?: BolReturn[] }>(
        connection,
        `/retailer/returns?handled=${handled}&page=${page}`,
      );
      const pageReturns = payload.returns ?? [];
      for (const item of pageReturns) {
        if (!item.returnId) continue;
        const details = item.returnItems?.length
          ? item
          : await bolRequest<BolReturn>(connection, `/retailer/returns/${encodeURIComponent(item.returnId)}`)
            .catch(() => item);
        const orderExternalId = details.returnItems?.find((returnItem) => returnItem.orderId)?.orderId ?? null;
        const { data: order } = orderExternalId
          ? await supabase.from("commerce_orders").select("id").eq("tenant_id", connection.tenantId).eq("provider", "bol").eq("external_id", orderExternalId).maybeSingle()
          : { data: null };
        const isHandled = (details.returnItems ?? []).length > 0 && (details.returnItems ?? []).every((returnItem) => returnItem.handled);
        const { data: savedReturn, error } = await supabase.from("commerce_returns").upsert({
          tenant_id: connection.tenantId,
          connection_id: connection.id,
          order_id: order?.id ?? null,
          provider: "bol",
          external_id: details.returnId,
          fulfilment_method: details.fulfilmentMethod ?? null,
          registered_at: details.registrationDateTime ?? null,
          handled: isHandled,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,provider,external_id" }).select("id").single();
        if (error || !savedReturn) throw new Error(`Could not save bol.com return: ${error?.message ?? "missing id"}`);
        const rows = (details.returnItems ?? [])
          .filter((returnItem) => returnItem.rmaId && returnItem.orderId)
          .map((returnItem) => {
            const normalized = normalizeBolReturnItem(returnItem);
            return {
              tenant_id: connection.tenantId,
              return_id: savedReturn.id,
              order_id: order?.id ?? null,
              external_id: returnItem.rmaId,
              order_external_id: returnItem.orderId,
              ean: returnItem.ean ?? null,
              title: null,
              expected_quantity: normalized.expectedQuantity,
              handled_quantity: normalized.handledQuantity,
              handled: normalized.handled,
              handling_result: normalized.handlingResult,
              reason: normalized.reason,
              updated_at: new Date().toISOString(),
            };
          });
        if (rows.length) {
          const { error: itemsError } = await supabase.from("commerce_return_items").upsert(rows, { onConflict: "return_id,external_id" });
          if (itemsError) throw new Error(`Could not save bol.com return items: ${itemsError.message}`);
        }
        saved += 1;
      }
      if (pageReturns.length < 50) break;
    }
  }
  await supabase.from("commerce_connections").update({
    last_returns_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("tenant_id", connection.tenantId);
  return saved;
}

export async function syncBolOffersForOrder(connection: CommerceConnection, orderId: string, normalized: NormalizedCommerceOrder) {
  const supabase = getSupabaseAdmin();
  for (const item of normalized.items) {
    if (!item.offerExternalId) continue;
    const offer = await bolRequest<BolOffer>(connection, `/retailer/offers/${encodeURIComponent(item.offerExternalId)}`, { version: 11 })
      .catch(() => null);
    if (!offer) continue;
    const price = offer.price ?? offer.pricing?.bundlePrices?.find((bundle) => bundle.quantity === 1)?.unitPrice ?? null;
    const { error } = await supabase.from("commerce_offer_snapshots").upsert({
      tenant_id: connection.tenantId,
      connection_id: connection.id,
      order_id: orderId,
      provider: "bol",
      external_id: item.offerExternalId,
      ean: offer.ean ?? item.ean ?? null,
      bol_product_id: offer.product?.bolProductId ?? null,
      fulfilment_method: offer.fulfilment?.method ?? item.fulfilmentMethod ?? null,
      stock_amount: offer.stock?.amount ?? null,
      corrected_stock: offer.stock?.correctedStock ?? null,
      price,
      currency_code: "EUR",
      for_sale: offer.countryAvailabilities?.some((country) => country.forSale) ?? null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider,external_id,order_id" });
    if (error) throw new Error(`Could not save bol.com offer context: ${error.message}`);
  }
}

export async function persistBolOrderContext(
  connection: CommerceConnection,
  order: NormalizedCommerceOrder,
) {
  const orderId = await upsertCommerceOrder(connection, order);
  await syncBolOffersForOrder(connection, orderId, order);
  return orderId;
}

async function saveSyncCursor(
  connection: CommerceConnection,
  resource: "orders" | "returns",
  input: { success: boolean; error?: string },
) {
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("commerce_sync_cursors").upsert({
    tenant_id: connection.tenantId,
    connection_id: connection.id,
    resource,
    last_success_at: input.success ? now : undefined,
    next_run_at: new Date(Date.now() + (resource === "returns" ? 15 : 5) * 60_000).toISOString(),
    last_error: input.error?.slice(0, 1000) ?? null,
    attempts: input.success ? 0 : 1,
    updated_at: now,
  }, { onConflict: "tenant_id,connection_id,resource" });
  if (error) throw new Error(`Could not save the bol.com ${resource} sync cursor: ${error.message}`);
}

function subscriptionId(subscription: BolSubscription) {
  return subscription.id ?? subscription.subscriptionId ?? null;
}

export async function syncBolSubscriptionHealth(connection: CommerceConnection) {
  const supabase = getSupabaseAdmin();
  const { data: stored, error: storedError } = await supabase.from("commerce_subscriptions")
    .select("id,callback_url,process_status_id,status")
    .eq("tenant_id", connection.tenantId)
    .eq("connection_id", connection.id);
  if (storedError) throw new Error(`Could not inspect bol.com subscriptions: ${storedError.message}`);

  let remote: BolSubscription[] = [];
  let signatureKeys: BolSignatureKey[] = [];
  try {
    const [subscriptions, keys] = await Promise.all([
      bolRequest<{ subscriptions?: BolSubscription[] }>(connection, "/retailer/subscriptions"),
      bolRequest<{ signatureKeys?: BolSignatureKey[] }>(connection, "/retailer/subscriptions/signature-keys"),
    ]);
    remote = subscriptions.subscriptions ?? [];
    signatureKeys = (keys.signatureKeys ?? [])
      .filter((key) => key.id !== undefined && Boolean(key.publicKey))
      .map((key) => ({ id: String(key.id), publicKey: key.publicKey }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "bol.com subscription health check failed.";
    await supabase.from("commerce_connections").update({
      events_status: "failed",
      last_error: message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq("id", connection.id).eq("tenant_id", connection.tenantId);
    throw error;
  }

  let active = false;
  let failed = false;
  const keysReady = signatureKeys.length > 0;
  for (const row of stored ?? []) {
    const found = remote.find((candidate) => candidate.url === row.callback_url);
    if (found) {
      const foundActive = found.enabled !== false && keysReady;
      active ||= foundActive;
      failed ||= found.enabled === false;
      await supabase.from("commerce_subscriptions").update({
        external_id: subscriptionId(found),
        status: found.enabled === false ? "failed" : keysReady ? "active" : "pending",
        signature_keys: signatureKeys,
        last_verified_at: new Date().toISOString(),
        last_error: found.enabled === false
          ? "bol.com disabled this event subscription."
          : keysReady ? null : "Waiting for bol.com signature keys.",
        updated_at: new Date().toISOString(),
      }).eq("id", row.id).eq("tenant_id", connection.tenantId);
      continue;
    }
    if (row.process_status_id && row.status === "pending") {
      const process = await bolRequest<BolProcessStatus>(
        connection,
        `/shared/process-status/${encodeURIComponent(row.process_status_id)}`,
      ).catch(() => null);
      const status = String(process?.status ?? "").toUpperCase();
      if (status === "SUCCESS") {
        active ||= keysReady;
        await supabase.from("commerce_subscriptions").update({
          external_id: process?.entityId ?? null,
          status: keysReady ? "active" : "pending",
          signature_keys: signatureKeys,
          last_verified_at: new Date().toISOString(),
          last_error: keysReady ? null : "Waiting for bol.com signature keys.",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("tenant_id", connection.tenantId);
      } else if (status === "FAILURE") {
        failed = true;
        await supabase.from("commerce_subscriptions").update({
          status: "failed",
          last_verified_at: new Date().toISOString(),
          last_error: process?.errorMessage?.slice(0, 1000) || "bol.com rejected the event subscription.",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("tenant_id", connection.tenantId);
      }
    }
  }

  const setupStage = active
    ? connection.mailboxVerifiedAt ? "complete" : "mailbox"
    : connection.setupStage === "complete" ? "mailbox" : connection.setupStage;
  const eventsStatus: "active" | "failed" | "pending" = active
    ? "active"
    : failed ? "failed" : "pending";
  await supabase.from("commerce_connections").update({
    events_status: eventsStatus,
    setup_stage: setupStage,
    last_error: active ? null : failed
      ? "bol.com rejected or disabled the event subscription."
      : connection.lastError,
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("tenant_id", connection.tenantId);
  return { active, status: eventsStatus };
}

export async function resolveBolEventOrderId(
  connection: CommerceConnection,
  topic: string,
  resourceId: string,
) {
  if (topic === "ORDER") return resourceId;
  if (topic !== "SHIPMENT") return null;
  const shipment = await bolRequest<BolShipment>(
    connection,
    `/retailer/shipments/${encodeURIComponent(resourceId)}`,
  );
  return shipment.order?.orderId ?? null;
}

export async function syncBolContext(
  connection: CommerceConnection,
  changeIntervalMinutes = 60,
  includeReturns = true,
) {
  const ids = await listBolOrderIds(connection, `&change-interval-minute=${Math.min(60, Math.max(1, changeIntervalMinutes))}`)
    .catch(async (error) => {
      await saveSyncCursor(connection, "orders", {
        success: false,
        error: error instanceof Error ? error.message : "bol.com order sync failed.",
      });
      throw error;
    });
  let orders = 0;
  for (const id of ids) {
    const order = await getBolOrder(connection, id);
    if (!order) continue;
    await persistBolOrderContext(connection, order);
    orders += 1;
  }
  await saveSyncCursor(connection, "orders", { success: true });
  await getSupabaseAdmin().from("commerce_connections").update({
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("tenant_id", connection.tenantId);
  const returns = includeReturns
    ? await persistBolReturns(connection).catch(async (error) => {
        await saveSyncCursor(connection, "returns", {
          success: false,
          error: error instanceof Error ? error.message : "bol.com return sync failed.",
        });
        throw error;
      })
    : 0;
  if (includeReturns) await saveSyncCursor(connection, "returns", { success: true });
  await getSupabaseAdmin().from("commerce_connections").update({
    last_synced_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("tenant_id", connection.tenantId);
  return { orders, returns };
}

export class BolAdapter implements CommerceAdapter {
  async refreshToken(connection: CommerceConnection) {
    const result = await getBolAccessToken(connection, true);
    return { scopes: result.scopes, expiresAt: result.expiresAt };
  }

  async testConnection(connection: CommerceConnection) {
    const token = await getBolAccessToken(connection, true);
    const [retailer] = await Promise.all([
      bolRequest<BolRetailer>(connection, "/retailer/retailers/current"),
      bolRequest(connection, "/retailer/orders?fulfilment-method=ALL&status=OPEN&page=1"),
    ]);
    const accountId = retailer.retailerId === undefined
      ? token.accountId
      : String(retailer.retailerId);
    return {
      shopName: retailer.displayName || (accountId ? `bol.com account ${accountId}` : "bol.com verkoopaccount"),
      currencyCode: "EUR",
      scopes: token.scopes,
      accountId,
    };
  }

  async findOrders(connection: CommerceConnection, input: { email?: string; orderNumber?: string }) {
    if (input.orderNumber) {
      const order = await getBolOrder(connection, input.orderNumber.trim().toUpperCase());
      return order ? [order] : [];
    }
    if (!input.email) return [];
    const ids = await listBolOrderIds(connection);
    const orders = await Promise.all(ids.slice(0, 50).map((id) => getBolOrder(connection, id)));
    return orders.filter((order): order is NormalizedCommerceOrder =>
      Boolean(order?.customerEmail && order.customerEmail.toLowerCase() === input.email!.trim().toLowerCase()));
  }

  getOrder(connection: CommerceConnection, externalOrderId: string) {
    return getBolOrder(connection, externalOrderId);
  }

  async registerWebhooks(connection: CommerceConnection, callbackUrl: string) {
    const existing = await bolRequest<{ subscriptions?: BolSubscription[] }>(
      connection,
      "/retailer/subscriptions",
    );
    const found = (existing.subscriptions ?? []).find((subscription) =>
      subscription.url === callbackUrl
      && ["ORDER", "SHIPMENT"].every((resource) => subscription.resources?.includes(resource)));
    const foundId = found ? subscriptionId(found) : null;
    if (foundId) {
      await getSupabaseAdmin().from("commerce_subscriptions").upsert({
        tenant_id: connection.tenantId, connection_id: connection.id, provider: "bol",
        external_id: foundId, resources: ["ORDER", "SHIPMENT"], callback_url: callbackUrl,
        status: "active", last_verified_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,connection_id,callback_url" });
      return;
    }
    const result = await bolRequest<{ processStatusId?: string }>(connection, "/retailer/subscriptions", {
      method: "POST",
      body: {
        resources: ["ORDER", "SHIPMENT"],
        url: callbackUrl,
        subscriptionType: "WEBHOOK",
        enabled: true,
      },
    });
    const { error } = await getSupabaseAdmin().from("commerce_subscriptions").upsert({
      tenant_id: connection.tenantId, connection_id: connection.id, provider: "bol",
      resources: ["ORDER", "SHIPMENT"], callback_url: callbackUrl, status: "pending",
      process_status_id: result.processStatusId ?? null, last_error: null, updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,connection_id,callback_url" });
    if (error) throw new Error(`Could not save bol.com subscription: ${error.message}`);
  }

  async unregisterWebhooks(connection: CommerceConnection, callbackUrl: string) {
    const existing = await bolRequest<{ subscriptions?: BolSubscription[] }>(connection, "/retailer/subscriptions");
    for (const subscription of existing.subscriptions ?? []) {
      const id = subscriptionId(subscription);
      if (id && subscription.url === callbackUrl) {
        await bolRequest(connection, `/retailer/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
    }
  }

  async syncRecentOrders(connection: CommerceConnection) {
    const ids = await listBolOrderIds(connection, "&change-interval-minute=60");
    const orders = await Promise.all(ids.map((id) => getBolOrder(connection, id)));
    return orders.filter((order): order is NormalizedCommerceOrder => Boolean(order));
  }
}
