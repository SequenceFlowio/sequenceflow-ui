import { buildCommercePromptContext, loadConversationCommerce } from "@/lib/commerce/resolution";
import { getInboundEmailDomain } from "@/lib/email/inbound/address";
import { extractVisibleReplyText } from "@/lib/email/inbound/replyText";
import { replySubject } from "@/lib/email/replySubject";
import { retrieveKnowledgeMatches } from "@/lib/knowledge/retrieveKnowledgeContext";
import { loadLumenSnapshot } from "@/lib/lumen/context";
import {
  McpToolError,
  readEnumArg,
  readIntArg,
  readStringArg,
  readUuidArg,
  type McpTool,
} from "@/lib/mcp/core";
import { INVENTORY_PLANS, getTenantPlanAccess } from "@/lib/billing";
import type { McpCaller } from "@/lib/mcp/tokens";
import { addDays, daysBetween, isDay, shopDay, variantLabel, type VariantMetrics } from "@/lib/inventory/core";
import { STATUS_FILTERS, reportView, type StatusFilter } from "@/lib/inventory/reportCore";
import { inventoryAdviceEnabled, loadCachedInventoryReport, loadSeasonReport, rebuildInventoryReport } from "@/lib/inventory/sync";
import { isCurrentSupportDraft } from "@/lib/support/draftFreshness";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * What an MCP client (Claude, ChatGPT, …) can ask Support One. Read-only and
 * always scoped to the tenant behind the access key.
 */

const CONVERSATION_STATUSES = ["open", "review", "pending_autosend", "sent", "escalated", "ignored", "closed", "archived", "spam"] as const;
const MESSAGE_BODY_MAX = 4_000;

function clip(text: string | null | undefined, max = MESSAGE_BODY_MAX) {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Hides the shop's own forwarding address, which is not a customer. */
function customerEmail(email: string | null, tenantId: string) {
  if (!email) return null;
  const domain = getInboundEmailDomain();
  const lower = email.toLowerCase();
  return lower.endsWith(`@${domain}`) || lower === `t-${tenantId}@${domain}` ? null : email;
}

/** PostgREST `or` filters break on these characters; search text never needs them. */
function searchTerm(value: string) {
  return value.replace(/[,()%*\\:"]/g, " ").replace(/\s+/g, " ").trim();
}

async function inventoryReport(tenantId: string) {
  const report = await loadCachedInventoryReport(tenantId);
  return report && report.version === 1 ? report : rebuildInventoryReport(tenantId);
}

/** A variant in a few fields, so a model can read 50 of them without drowning. */
function compactVariant(metric: VariantMetrics) {
  return {
    variant: variantLabel(metric),
    sku: metric.sku,
    ean: metric.ean,
    options: metric.options,
    channels: metric.channels,
    status: metric.status,
    stock: metric.stock,
    incoming: metric.incoming || undefined,
    soldLast30Days: metric.sold30,
    soldLast90Days: metric.sold90,
    soldLast365Days: metric.sold365,
    unitsPerWeek: metric.velocityPerWeek,
    speedBasedOn: metric.velocityBasis,
    daysOfStockLeft: metric.daysOfStock,
    seasonFactor: metric.seasonFactor !== 1 ? metric.seasonFactor : undefined,
    recommendedOrder: metric.recommendedOrder,
    stockValueEur: metric.stockValue,
    stockValueBasis: metric.stockValueBasis,
    lastSale: metric.lastSaleDay,
    returns: metric.returns.units ? metric.returns : undefined,
    customerQuestionsLast90Days: metric.questions?.total ? metric.questions : undefined,
  };
}

const INVENTORY_TOOLS: McpTool<McpCaller>[] = [
  {
    name: "get_inventory_health",
    title: "Stock and buying overview",
    description: "Stock health of the shop per product variant (size, colour): dead stock and the money tied up in it, variants running low or sold out, how many units to reorder, and this week's most important buying actions with their numbers. Computed from sales and stock per variant across bol.com, Shopify and WooCommerce, plus which sizes and colours customers ask about in the support inbox (fit, back in stock, quality) over the last 90 days. Start here for any question about stock or purchasing.",
    inputSchema: {
      type: "object",
      properties: { language: { type: "string", enum: ["nl", "en"], description: "Language of the actions. Default: nl." } },
      additionalProperties: false,
    },
    async run(args, caller) {
      const language = readEnumArg(args, "language", ["nl", "en"] as const) ?? "nl";
      const report = await inventoryReport(caller.tenantId);
      const view = reportView(report, { language, limit: 1 });
      return {
        computedAt: report.builtAt,
        salesHistoryFrom: report.historyFrom,
        channels: report.channels,
        settings: report.settings,
        summary: report.summary,
        actions: view.actions.map(({ title, text, quantity }) => ({ title, text, quantity })),
        customerQuestions: {
          conversationsAboutProducts: view.questions.conversations,
          mostAskedAbout: view.questions.insights.map(({ label, count, topic, text }) => ({ variant: label, conversations: count, mainTopic: topic, meaning: text })),
        },
        howItIsCalculated: "Speed = units sold in the last 8 weeks per day the variant was in stock. Order = speed × (lead time + cover weeks) × season factor × (1 + buffer) − stock − incoming. Dead = no sale in deadAfterDays, or more stock than deadCoverWeeks of sales.",
      };
    },
  },
  {
    name: "list_inventory_variants",
    title: "List variants with stock and sales",
    description: "Variants with stock, sales over 30/90/365 days, speed per week, days of stock left, status and the recommended order quantity. Filter by status ('dead', 'low', 'out_of_stock', 'to_order', 'attention', 'healthy') and search by product name, size, colour, SKU or EAN.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...STATUS_FILTERS], description: "Which variants. Default: all." },
        search: { type: "string", maxLength: 100, description: "Product name, option (e.g. 'roze', '32'), SKU or EAN." },
        channel: { type: "string", enum: ["shopify", "woocommerce", "bol", "import"], description: "Only variants sold on this channel." },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum variants. Default: 30." },
      },
      additionalProperties: false,
    },
    async run(args, caller) {
      const status = (readEnumArg(args, "status", STATUS_FILTERS) ?? "all") as StatusFilter;
      const search = readStringArg(args, "search", { max: 100 }) ?? "";
      const channel = readEnumArg(args, "channel", ["shopify", "woocommerce", "bol", "import"] as const);
      const limit = readIntArg(args, "limit", { min: 1, max: 100, fallback: 30 });
      const view = reportView(await inventoryReport(caller.tenantId), { status, search, channel, limit, language: "en" });
      return { total: view.variants.total, shown: view.variants.rows.length, variants: view.variants.rows.map(compactVariant) };
    },
  },
  {
    name: "get_season_sales",
    title: "Sales in a season last year",
    description: "What sold between two dates one year earlier: best products, best variants and variants that hardly sold but are in stock now. Use it before buying for a season, e.g. from 2026-11-01 to 2026-12-31 to see Q4 2025.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "First day of the coming period, YYYY-MM-DD." },
        to: { type: "string", description: "Last day of the coming period, YYYY-MM-DD (at most a year after from)." },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
    async run(args, caller) {
      const from = readStringArg(args, "from", { required: true, max: 10 })!;
      const to = readStringArg(args, "to", { required: true, max: 10 })!;
      if (!isDay(from) || !isDay(to) || to < from || daysBetween(from, to) > 366) throw new McpToolError("Use YYYY-MM-DD dates, at most a year apart.");
      if (from > addDays(shopDay(new Date()), 730)) throw new McpToolError("Pick a period within the next two years.");
      return loadSeasonReport(caller.tenantId, from, to);
    },
  },
];

const BASE_TOOLS: McpTool<McpCaller>[] = [
  {
    name: "get_support_overview",
    title: "Support overview",
    description: "The last 30 days of this shop at a glance: support volume and what still needs review, top customer intents, auto-send and confidence, commerce signals (orders, low stock, returns, shipments without tracking, top products), knowledge base and agent profile status, and suggested next questions. Start here.",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["nl", "en"], description: "Language for labels and suggestions. Default: nl." },
      },
      additionalProperties: false,
    },
    async run(args, caller) {
      const language = readEnumArg(args, "language", ["nl", "en"] as const) ?? "nl";
      return loadLumenSnapshot(caller.tenantId, language);
    },
  },
  {
    name: "list_conversations",
    title: "List conversations",
    description: "Customer conversations in the support inbox, newest first, with status, detected intent, the AI's confidence and whether a human must review. Filter by status (e.g. 'review' for drafts waiting on the shop) or search subject, customer name and email.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...CONVERSATION_STATUSES], description: "Only conversations with this status." },
        search: { type: "string", maxLength: 100, description: "Text to find in subject, customer name or email." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Maximum results. Default: 20." },
      },
      additionalProperties: false,
    },
    async run(args, caller) {
      const status = readEnumArg(args, "status", CONVERSATION_STATUSES);
      const search = readStringArg(args, "search", { max: 100 });
      const limit = readIntArg(args, "limit", { min: 1, max: 50, fallback: 20 });
      const supabase = getSupabaseAdmin();

      let query = supabase.from("support_conversations")
        .select("id,status,customer_email,customer_name,subject_original,latest_decision_id,latest_message_at,scheduled_send_at")
        .eq("tenant_id", caller.tenantId)
        .order("latest_message_at", { ascending: false })
        .limit(limit);
      if (status) query = query.eq("status", status);
      const term = search ? searchTerm(search) : "";
      if (term) {
        query = query.or(["subject_original", "customer_name", "customer_email"].map((column) => `${column}.ilike.*${term}*`).join(","));
      }
      const { data: conversations, error } = await query;
      if (error) throw error;

      const decisionIds = (conversations ?? []).map((row) => row.latest_decision_id).filter(Boolean) as string[];
      const { data: decisions, error: decisionError } = decisionIds.length
        ? await supabase.from("support_decisions")
          .select("id,intent,confidence,requires_human")
          .eq("tenant_id", caller.tenantId)
          .in("id", decisionIds)
        : { data: [], error: null };
      if (decisionError) throw decisionError;
      const byId = new Map((decisions ?? []).map((decision) => [decision.id, decision]));

      return {
        count: conversations?.length ?? 0,
        conversations: (conversations ?? []).map((row) => {
          const decision = row.latest_decision_id ? byId.get(row.latest_decision_id) : null;
          return {
            id: row.id,
            status: row.status,
            subject: row.subject_original,
            customerName: row.customer_name,
            customerEmail: customerEmail(row.customer_email, caller.tenantId),
            intent: decision?.intent ?? null,
            confidence: decision?.confidence != null ? Number(decision.confidence) : null,
            requiresHuman: Boolean(decision?.requires_human ?? true),
            scheduledSendAt: row.scheduled_send_at ?? null,
            lastMessageAt: row.latest_message_at,
          };
        }),
      };
    },
  },
  {
    name: "get_conversation",
    title: "Read a conversation",
    description: "One conversation in full: the messages with the customer, the current AI draft reply and why it needs review, and the linked order (status, items, tracking, returns, stock). Use an id from list_conversations.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Conversation id from list_conversations." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    async run(args, caller) {
      const id = readUuidArg(args, "id");
      const supabase = getSupabaseAdmin();
      const { data: conversation, error } = await supabase.from("support_conversations")
        .select("id,status,customer_email,customer_name,subject_original,latest_decision_id,latest_inbound_message_id,created_at,scheduled_send_at")
        .eq("tenant_id", caller.tenantId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!conversation) throw new McpToolError("No conversation with this id in this shop.");

      const [decisionResult, messageResult, commerce] = await Promise.all([
        conversation.latest_decision_id
          ? supabase.from("support_decisions")
            .select("source_message_id,intent,confidence,decision,requires_human,reasons,review_status,draft_subject_original,draft_body_original,draft_language")
            .eq("tenant_id", caller.tenantId)
            .eq("id", conversation.latest_decision_id)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("support_messages")
          .select("direction,from_email,subject_original,body_original,received_at,created_at")
          .eq("tenant_id", caller.tenantId)
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })
          .limit(50),
        conversation.customer_email
          ? loadConversationCommerce({ tenantId: caller.tenantId, conversationId: conversation.id, customerEmail: conversation.customer_email }).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (decisionResult.error) throw decisionResult.error;
      if (messageResult.error) throw messageResult.error;
      const decision = isCurrentSupportDraft(decisionResult.data, conversation.latest_inbound_message_id) ? decisionResult.data : null;

      return {
        id: conversation.id,
        status: conversation.status,
        subject: conversation.subject_original,
        customer: { name: conversation.customer_name, email: customerEmail(conversation.customer_email, caller.tenantId) },
        createdAt: conversation.created_at,
        scheduledSendAt: conversation.scheduled_send_at ?? null,
        messages: (messageResult.data ?? []).map((message) => ({
          direction: message.direction,
          from: customerEmail(message.from_email, caller.tenantId),
          at: message.received_at ?? message.created_at,
          subject: message.subject_original,
          body: clip(message.direction === "inbound" ? extractVisibleReplyText(message.body_original) : message.body_original),
        })),
        draft: decision ? {
          intent: decision.intent,
          confidence: decision.confidence != null ? Number(decision.confidence) : null,
          decision: decision.decision,
          requiresHuman: Boolean(decision.requires_human),
          reviewStatus: decision.review_status ?? null,
          reasons: Array.isArray(decision.reasons) ? decision.reasons : [],
          subject: replySubject(conversation.subject_original, decision.draft_subject_original),
          body: clip(decision.draft_body_original),
          language: decision.draft_language,
        } : null,
        order: commerce ? buildCommercePromptContext(commerce).replace(/^COMMERCE CONTEXT\n/, "") : null,
      };
    },
  },
  {
    name: "search_knowledge",
    title: "Search the knowledge base",
    description: "Searches the shop's own knowledge base (policies, FAQ, product info, documents) that Support One answers from. Returns the most relevant passages with their document title.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 300, description: "What to look up, e.g. 'retourtermijn' or 'levertijd België'." },
        limit: { type: "integer", minimum: 1, maximum: 10, description: "Maximum passages. Default: 5." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    async run(args, caller) {
      const query = readStringArg(args, "query", { required: true, max: 300 })!;
      const limit = readIntArg(args, "limit", { min: 1, max: 10, fallback: 5 });
      const matches = await retrieveKnowledgeMatches(caller.tenantId, query, limit);
      return {
        count: matches.length,
        matches: matches.map((match) => ({
          title: match.title,
          type: match.docType,
          source: match.source,
          similarity: match.similarity == null ? null : Math.round(match.similarity * 100) / 100,
          text: match.content,
        })),
      };
    },
  },
];

/** Below Scale the inventory tools stay listed, so the model can tell the shop what an upgrade adds. */
const PLAN_GATED_INVENTORY_TOOLS: McpTool<McpCaller>[] = INVENTORY_TOOLS.map((tool) => ({
  ...tool,
  async run(args, caller) {
    const { plan } = await getTenantPlanAccess(caller.tenantId);
    if (!INVENTORY_PLANS.includes(plan)) throw new McpToolError("Stock and buying advice is part of the Scale plan. The shop can upgrade under Settings → Billing in Support One.");
    return tool.run(args, caller);
  },
}));

export const MCP_TOOLS: McpTool<McpCaller>[] = inventoryAdviceEnabled() ? [...BASE_TOOLS, ...PLAN_GATED_INVENTORY_TOOLS] : BASE_TOOLS;
