import { customerKey } from "@/lib/commerce/identity";
import { deleteInboundAttachmentsForConversation } from "@/lib/email/inbound/messageAttachments";
import { deleteScheduledAttachments } from "@/lib/email/outbound/scheduledAttachments";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { customerPrivacyScope, exactEmailPattern, isSameEmail } from "@/lib/shopify/webhookPolicy";

/**
 * Shopify's mandatory privacy webhooks. Everything here is scoped to one
 * tenant, and the merchant's own data outside Shopify is only removed when the
 * workspace was created for the shop (see planShopRedaction).
 */

const KNOWLEDGE_BUCKET = "knowledge-uploads";

function orClause(key: string | null, orderGids: string[]) {
  const parts: string[] = [];
  if (key) parts.push(`customer_key.eq.${key}`);
  if (orderGids.length) parts.push(`external_id.in.(${orderGids.map((gid) => `"${gid}"`).join(",")})`);
  return parts.length ? parts.join(",") : null;
}

type PrivacyRequest = { tenantId: string; tenantOrigin: string | null; email: string | null; orderGids: string[] };

// The database filter narrows the search; the exact comparison below decides.
// PostgREST treats some characters (like *) as wildcards, so never trust it alone.
const sameEmail = isSameEmail;

async function customerConversationIds(tenantId: string, email: string) {
  const { data, error } = await getSupabaseAdmin().from("support_conversations")
    .select("id, customer_email").eq("tenant_id", tenantId).ilike("customer_email", exactEmailPattern(email));
  if (error) throw new Error(`Could not find customer conversations: ${error.message}`);
  return (data ?? []).filter((row) => sameEmail(row.customer_email, email)).map((row) => String(row.id));
}

/**
 * customers/data_request: what this workspace stores about one customer from
 * this Shopify store. Support mail is included only when the workspace was
 * created for the shop; a linked workspace's other mail is not Shopify's to share.
 */
export async function exportShopifyCustomerData({ tenantId, tenantOrigin, email, orderGids }: PrivacyRequest) {
  const db = getSupabaseAdmin();
  const includeMail = customerPrivacyScope(tenantOrigin) === "workspace";
  const conversations = email && includeMail ? await (async () => {
    const { data, error } = await db.from("support_conversations")
      .select("id, status, customer_email, customer_name, subject_original, created_at, latest_message_at")
      .eq("tenant_id", tenantId).ilike("customer_email", exactEmailPattern(email)).order("created_at", { ascending: true });
    if (error) throw new Error(`Could not export conversations: ${error.message}`);
    const exact = (data ?? []).filter((row) => sameEmail(row.customer_email, email));
    const ids = exact.map((row) => row.id);
    const { data: messages, error: messageError } = ids.length
      ? await db.from("support_messages")
        .select("conversation_id, direction, from_email, from_name, to_email, subject_original, body_original, received_at, sent_at, created_at")
        .eq("tenant_id", tenantId).in("conversation_id", ids).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (messageError) throw new Error(`Could not export messages: ${messageError.message}`);
    return exact.map((conversation) => ({
      ...conversation,
      messages: (messages ?? []).filter((message) => message.conversation_id === conversation.id)
        .map((message) => ({ ...message, conversation_id: undefined })),
    }));
  })() : [];

  // Only orders from Shopify: a linked workspace may also hold bol/WooCommerce orders.
  const filter = orClause(email ? customerKey(tenantId, email) : null, orderGids);
  const { data: orders, error: orderError } = filter
    ? await db.from("commerce_orders")
      .select("display_name, provider, financial_status, fulfillment_status, total_amount, currency_code, order_created_at, commerce_order_items(title, variant_title, quantity), commerce_fulfillments(status, tracking_company, tracking_number)")
      .eq("tenant_id", tenantId).eq("provider", "shopify").or(filter)
    : { data: [], error: null };
  if (orderError) throw new Error(`Could not export orders: ${orderError.message}`);

  return {
    generatedAt: new Date().toISOString(),
    customerEmail: email,
    requestedOrders: orderGids,
    supportConversations: conversations,
    supportConversationsNote: includeMail ? null : "This workspace also receives mail outside Shopify; support conversations are managed by the merchant in Support One.",
    cachedOrderContext: orders ?? [],
  };
}

/**
 * customers/redact. Shopify order data always goes. Support mail, legacy
 * tickets and case memory only go when the workspace was created for the shop;
 * a linked workspace keeps mail that did not come through Shopify.
 */
export async function redactShopifyCustomer({ tenantId, tenantOrigin, email, orderGids }: PrivacyRequest) {
  const db = getSupabaseAdmin();
  let conversations = 0;
  if (email && customerPrivacyScope(tenantOrigin) === "workspace") {
    const ids = await customerConversationIds(tenantId, email);
    for (const id of ids) {
      await deleteInboundAttachmentsForConversation(db, id);
      await deleteScheduledAttachments(db, { tenantId, conversationId: id });
    }
    if (ids.length) {
      const { error } = await db.from("support_conversations").delete().eq("tenant_id", tenantId).in("id", ids);
      if (error) throw new Error(`Could not delete conversations: ${error.message}`);
    }
    conversations = ids.length;
    const { data: tickets, error: ticketLookupError } = await db.from("tickets").select("id, from_email").eq("tenant_id", tenantId).ilike("from_email", exactEmailPattern(email));
    if (ticketLookupError) throw new Error(`Could not find legacy tickets: ${ticketLookupError.message}`);
    const ticketIds = (tickets ?? []).filter((row) => sameEmail(row.from_email, email)).map((row) => String(row.id));
    if (ticketIds.length) {
      const { error: ticketError } = await db.from("tickets").delete().eq("tenant_id", tenantId).in("id", ticketIds);
      if (ticketError) throw new Error(`Could not delete legacy tickets: ${ticketError.message}`);
    }
    const { error: memoryError } = await db.from("case_memories").delete().eq("tenant_id", tenantId).eq("customer_key", customerKey(tenantId, email));
    if (memoryError) throw new Error(`Could not delete case memory: ${memoryError.message}`);
  }
  const filter = orClause(email ? customerKey(tenantId, email) : null, orderGids);
  if (filter) {
    const { error } = await db.from("commerce_orders").delete().eq("tenant_id", tenantId).eq("provider", "shopify").or(filter);
    if (error) throw new Error(`Could not delete cached orders: ${error.message}`);
  }
  return { conversations };
}

/** shop/redact for a linked workspace: only what came from Shopify goes. */
export async function deleteShopifyDataForTenant(tenantId: string) {
  // Cascades to cached orders, items, fulfillments and links.
  const { error } = await getSupabaseAdmin().from("commerce_connections").delete().eq("tenant_id", tenantId).eq("provider", "shopify");
  if (error) throw new Error(`Could not delete Shopify connection: ${error.message}`);
}

/** shop/redact for a workspace that was created for the shop: delete everything. */
export async function deleteShopifyWorkspace(tenantId: string) {
  const db = getSupabaseAdmin();

  // Stored files first: once the rows are gone the paths are unknown.
  const { data: conversations, error: conversationError } = await db.from("support_conversations").select("id").eq("tenant_id", tenantId);
  if (conversationError) throw new Error(`Could not list conversations: ${conversationError.message}`);
  for (const row of conversations ?? []) await deleteInboundAttachmentsForConversation(db, String(row.id));
  await deleteScheduledAttachments(db, { tenantId });

  const { data: documents, error: documentError } = await db.from("knowledge_documents").select("id, source").eq("client_id", tenantId);
  if (documentError) throw new Error(`Could not list knowledge documents: ${documentError.message}`);
  const paths = (documents ?? []).map((doc) => `${tenantId}/${doc.id}/${doc.source}`);
  if (paths.length) {
    const { error } = await db.storage.from(KNOWLEDGE_BUCKET).remove(paths);
    if (error) throw new Error(`Could not delete knowledge files: ${error.message}`);
  }

  // Tables without a cascading tenant reference.
  for (const [table, column] of [["knowledge_chunks", "client_id"], ["knowledge_documents", "client_id"], ["tickets", "tenant_id"], ["support_agents", "tenant_id"], ["profiles", "tenant_id"]] as const) {
    const { error } = await db.from(table).delete().eq(column, tenantId);
    if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
  }
  const { error } = await db.from("tenants").delete().eq("id", tenantId);
  if (error) throw new Error(`Could not delete workspace: ${error.message}`);
}
