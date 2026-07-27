export type CommerceProvider = "shopify" | "woocommerce" | "bol";

export type CommerceConnection = {
  id: string;
  tenantId: string;
  provider: CommerceProvider;
  shopDomain: string;
  clientId: string;
  clientSecretEncrypted: string;
  accessTokenEncrypted: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  status: "test_required" | "active" | "paused" | "failed";
  actionMode: "disabled" | "approval_required";
  maxCancelAmount: number;
  shopCurrency: string | null;
  displayName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  externalAccountId: string | null;
  authMode: "client_credentials" | "oauth";
  setupStage: "credentials" | "api" | "events" | "mailbox" | "complete";
  mailboxVerifiedAt: string | null;
  eventsStatus: "not_configured" | "pending" | "active" | "failed" | "paused";
  lastReturnsSyncedAt: string | null;
};

export type NormalizedCommerceItem = {
  externalId: string;
  productExternalId: string | null;
  variantExternalId: string | null;
  sku: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  ean?: string | null;
  offerExternalId?: string | null;
  unitPrice?: number | null;
  fulfilmentMethod?: string | null;
  fulfilmentDistributionParty?: string | null;
  cancellationRequested?: boolean;
  latestDeliveryAt?: string | null;
};

export type NormalizedFulfillment = {
  externalId: string;
  status: string | null;
  trackingCompany: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shipmentDate?: string | null;
  transportStatusCode?: string | null;
  transportStatusDescription?: string | null;
  latestTransportEventAt?: string | null;
};

export type NormalizedCommerceOrder = {
  externalId: string;
  displayName: string;
  customerEmail: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalAmount: number;
  currencyCode: string;
  cancelable: boolean;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  items: NormalizedCommerceItem[];
  fulfillments: NormalizedFulfillment[];
};

export type CancelOrderInput = {
  externalOrderId: string;
  staffNote: string;
  idempotencyKey?: string;
};

export type CancelOrderResult = {
  status: "succeeded" | "provider_pending";
  providerJobId: string | null;
  response: Record<string, unknown>;
};

export interface CommerceAdapter {
  testConnection(connection: CommerceConnection): Promise<{ shopName: string; currencyCode: string; scopes: string[] }>;
  refreshToken(connection: CommerceConnection): Promise<{ scopes: string[]; expiresAt: string | null }>;
  findOrders(connection: CommerceConnection, query: { email?: string; orderNumber?: string }): Promise<NormalizedCommerceOrder[]>;
  getOrder(connection: CommerceConnection, externalOrderId: string): Promise<NormalizedCommerceOrder | null>;
  cancelOrder?(connection: CommerceConnection, input: CancelOrderInput): Promise<CancelOrderResult>;
  registerWebhooks(connection: CommerceConnection, callbackUrl: string): Promise<void>;
  unregisterWebhooks(connection: CommerceConnection, callbackUrl: string): Promise<void>;
  syncRecentOrders(connection: CommerceConnection, since: string): Promise<NormalizedCommerceOrder[]>;
}

export type CommerceReturnContext = {
  id: string;
  externalId: string;
  fulfilmentMethod: string | null;
  registeredAt: string | null;
  handled: boolean;
  items: Array<{
    externalId: string;
    ean: string | null;
    title: string | null;
    expectedQuantity: number;
    handledQuantity: number;
    handled: boolean;
    handlingResult: string | null;
    reason: string | null;
  }>;
};

export type CommerceOfferContext = {
  externalId: string;
  ean: string | null;
  bolProductId: string | null;
  fulfilmentMethod: string | null;
  stockAmount: number | null;
  correctedStock: number | null;
  price: number | null;
  currencyCode: string;
  forSale: boolean | null;
  lastSyncedAt: string;
};

export type CommerceOrderContext = {
  id: string;
  connectionId: string;
  provider: CommerceProvider;
  externalId: string;
  displayName: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalAmount: number;
  currencyCode: string;
  cancelable: boolean;
  cancelledAt: string | null;
  orderCreatedAt: string;
  lastSyncedAt: string;
  matchMethod: "order_number" | "customer_email" | "manual";
  matchConfidence: number;
  items: Array<{
    id: string;
    title: string;
    variantTitle: string | null;
    sku: string | null;
    quantity: number;
    ean: string | null;
    offerExternalId: string | null;
    unitPrice: number | null;
    fulfilmentMethod: string | null;
    fulfilmentDistributionParty: string | null;
    cancellationRequested: boolean;
    latestDeliveryAt: string | null;
  }>;
  fulfillments: Array<{
    id: string;
    status: string | null;
    trackingCompany: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shipmentDate: string | null;
    transportStatusCode: string | null;
    transportStatusDescription: string | null;
    latestTransportEventAt: string | null;
  }>;
  returns: CommerceReturnContext[];
  offers: CommerceOfferContext[];
};

export type CancelOrderAction = {
  type: "cancel_order";
  payload?: { orderId?: string };
};
