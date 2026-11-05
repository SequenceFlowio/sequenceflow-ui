import { recordAiUsage } from "@/lib/ai/usage";
import { alertsUnavailable, loadAlertRules } from "@/lib/inventory/alerts";
import { alertKindLabel } from "@/lib/inventory/alertsCore";
import { compactVariant, runAssistant, splitOrderOverVariants, validSeasonPeriod, type AssistantCompletion, type AssistantMessage, type AssistantResult, type ProposalContext, type ReadToolRunner, type Supplier } from "@/lib/inventory/assistantCore";
import { loadWaitlist, waitlistCandidates, waitlistDraft, waitlistUnavailable } from "@/lib/inventory/waitlist";
import { shopDay, startOfShopDay } from "@/lib/inventory/core";
import { REPORT_VERSION, STATUS_FILTERS, productSeasons, reportView, type InventoryReport, type StatusFilter } from "@/lib/inventory/reportCore";
import { loadCachedInventoryReport, loadInventorySettings, loadSeasonReport, loadSuppliers, rebuildInventoryReport } from "@/lib/inventory/sync";
import { getOpenAIClient } from "@/lib/openaiClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Milo's chat against the database and OpenAI: the read tools are thin layers
 * over the report and the stored rows, proposals are built from the same
 * report, and the usage is recorded but not billed (Scale includes it).
 */

export const ASSISTANT_MODEL = process.env.INVENTORY_ASSISTANT_MODEL?.trim() || "gpt-4.1-mini";
/** Questions per user per day; Scale includes Milo, this only stops runaway loops. */
export const ASSISTANT_DAILY_LIMIT = 60;

async function inventoryReport(tenantId: string) {
  const report = await loadCachedInventoryReport(tenantId);
  return report && report.version === REPORT_VERSION ? report : rebuildInventoryReport(tenantId);
}

async function shopName(tenantId: string) {
  const { data } = await getSupabaseAdmin().from("commerce_connections").select("display_name").eq("tenant_id", tenantId).eq("status", "active").order("created_at").limit(1).maybeSingle();
  return (data?.display_name as string | null) ?? null;
}

/** How many questions this user asked today (usage rows carry the user in their idempotency key). */
export async function assistantQuestionsToday(tenantId: string, userId: string, now = new Date()) {
  const start = startOfShopDay(now);
  const { count, error } = await getSupabaseAdmin().from("ai_usage_events").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("operation", "inventory_assistant").like("idempotency_key", `vera:${userId}:%`).gte("created_at", start);
  if (error) throw new Error(`Could not check Milo's limit: ${error.message}`);
  return count ?? 0;
}

const openAiCompletion: AssistantCompletion = async ({ messages, tools }) => {
  const completion = await getOpenAIClient().chat.completions.create({
    model: ASSISTANT_MODEL,
    messages: messages as Parameters<ReturnType<typeof getOpenAIClient>["chat"]["completions"]["create"]>[0]["messages"],
    ...(tools.length ? { tools, tool_choice: "auto" as const } : {}),
    temperature: 0.2,
    max_completion_tokens: 1500,
  });
  const choice = completion.choices[0];
  return {
    message: {
      content: choice?.message.content ?? null,
      tool_calls: choice?.message.tool_calls?.flatMap((call) => (call.type === "function" ? [{ id: call.id, type: "function" as const, function: { name: call.function.name, arguments: call.function.arguments } }] : [])),
    },
    usage: completion.usage,
  };
};

function readTools(tenantId: string, language: "nl" | "en", getReport: () => Promise<InventoryReport>, getSuppliers: () => Promise<Supplier[] | null>): ReadToolRunner {
  return async (tool, args) => {
    switch (tool) {
      case "get_inventory_health": {
        const report = await getReport();
        const view = reportView(report, { language, limit: 1 });
        return {
          computedAt: report.builtAt, today: report.today, salesHistoryFrom: report.historyFrom, channels: report.channels, settings: report.settings, summary: report.summary,
          actions: view.actions.map(({ title, text, quantity, variantKey }) => ({ title, text, quantity, variantKey })),
          customerQuestions: { conversationsAboutProducts: view.questions.conversations, mostAskedAbout: view.questions.insights.map(({ label, count, topic, text }) => ({ variant: label, conversations: count, mainTopic: topic, meaning: text })) },
          whereToSee: "Tab Overzicht on /inventory.",
        };
      }
      case "list_variants": {
        const status = (STATUS_FILTERS as readonly string[]).includes(String(args.status ?? "")) ? args.status as StatusFilter : "all";
        const search = typeof args.search === "string" ? args.search.slice(0, 100) : "";
        const channel = ["shopify", "woocommerce", "bol", "import"].includes(String(args.channel ?? "")) ? String(args.channel) : null;
        const limit = Math.min(100, Math.max(1, Number(args.limit) || 30));
        const view = reportView(await getReport(), { status, search, channel, limit, language });
        return { total: view.variants.total, shown: view.variants.rows.length, variants: view.variants.rows.map(compactVariant) };
      }
      case "get_season_sales": {
        const report = await getReport();
        if (!validSeasonPeriod(args.from, args.to, report.today)) return { error: "Use YYYY-MM-DD dates, at most a year apart and within the next two years." };
        return loadSeasonReport(tenantId, args.from as string, args.to as string);
      }
      case "get_deliveries": {
        const report = await getReport();
        return { deliveries: report.deliveries.slice(0, 100).map((delivery) => ({ id: delivery.id, variantKey: delivery.variantKey, variant: delivery.label, day: delivery.day, quantity: delivery.quantity, source: delivery.source, onItsWay: delivery.upcoming, soldAfter30Days: delivery.after30, soldAfter60Days: delivery.after60, soldAfter90Days: delivery.after90, soldSince: delivery.soldSince, note: delivery.note })), whereToSee: "Tab Leveringen en import." };
      }
      case "get_alerts": {
        try {
          const [rules, { data: open, error }] = await Promise.all([
            loadAlertRules(tenantId),
            getSupabaseAdmin().from("inventory_alerts").select("kind,title,body,impact,opened_at").eq("tenant_id", tenantId).is("resolved_at", null).order("impact", { ascending: false }).limit(50),
          ]);
          if (error) throw Object.assign(new Error(error.message), { code: error.code });
          return {
            openAlerts: (open ?? []).map((alert) => ({ kind: alert.kind, title: alert.title, body: alert.body, impactEur: Number(alert.impact), since: alert.opened_at })),
            rules: rules.map((rule) => ({ id: rule.id, kind: rule.kind, what: alertKindLabel(rule.kind, language), scope: rule.scope, target: rule.targetLabel, threshold: rule.threshold, enabled: rule.enabled })),
            whereToSee: "Voorraadoverzicht en Instellingen → Meldingen.",
          };
        } catch (error) {
          if (alertsUnavailable(error as { message?: string; code?: string })) return { notReady: true, note: "Alerts are not switched on for this environment yet (migration 061)." };
          throw error;
        }
      }
      case "get_products": {
        const [report, suppliers, settings] = await Promise.all([getReport(), getSuppliers(), loadInventorySettings(tenantId)]);
        const byId = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier.name]));
        return { products: productSeasons(report).map((product) => ({ ...product, supplier: byId.get(settings.productSuppliers[product.productKey] ?? "") ?? null })) };
      }
      case "get_waitlist": {
        const report = await getReport();
        try {
          if (typeof args.variantKey === "string") {
            const waitlist = await loadWaitlist(tenantId, report, args.variantKey);
            if (!waitlist) return { error: "Unknown variantKey." };
            return { variantKey: waitlist.variantKey, variant: waitlist.variant, stock: waitlist.stock, waiting: waitlist.customers.length, toMail: waitlist.toSend, alreadyMailed: waitlist.alreadySent, whereToSee: "Voorraadoverzicht en Instellingen → Meldingen, under the alert 'Weer op voorraad'." };
          }
          return { backInStockWithPeopleWaiting: waitlistCandidates(report), note: "Call get_waitlist with a variantKey for how many still need a mail; propose_waitlist_mail to mail them after confirmation.", whereToSee: "Voorraadoverzicht en Instellingen → Meldingen." };
        } catch (error) {
          if (waitlistUnavailable(error as { message?: string; code?: string })) return { notReady: true, note: "The waitlist is not switched on for this environment yet (migration 063)." };
          throw error;
        }
      }
      case "split_order_over_variants": {
        const totalUnits = Number(args.totalUnits);
        if (!Number.isInteger(totalUnits) || totalUnits <= 0 || totalUnits > 1_000_000) return { error: "totalUnits must be a whole number above 0." };
        const split = splitOrderOverVariants(await getReport(), String(args.productKey ?? ""), totalUnits);
        return split ?? { error: "Unknown productKey; take it from get_products or list_variants." };
      }
      case "get_suppliers": {
        const [suppliers, settings, report] = await Promise.all([getSuppliers(), loadInventorySettings(tenantId), getReport()]);
        if (!suppliers) return { notReady: true, note: "Suppliers are not switched on for this environment yet (migration 062)." };
        const titles = new Map(productSeasons(report).map((product) => [product.productKey, product.productTitle]));
        return {
          suppliers: suppliers.map((supplier) => ({ ...supplier, products: Object.entries(settings.productSuppliers).filter(([, id]) => id === supplier.id).map(([productKey]) => ({ productKey, product: titles.get(productKey) ?? productKey })) })),
          shopLeadTimeDays: report.settings.leadTimeDays,
          whereToSee: "Tab Instellingen, under Leveranciers.",
        };
      }
    }
  };
}

export async function askVera(input: { tenantId: string; userId: string; messages: AssistantMessage[]; language: "nl" | "en"; canManage: boolean; requestId: string; now?: Date; complete?: AssistantCompletion }): Promise<AssistantResult> {
  const now = input.now ?? new Date();
  const today = shopDay(now);
  let report: Promise<InventoryReport> | null = null;
  const getReport = () => (report ??= inventoryReport(input.tenantId));
  let suppliers: Promise<Supplier[] | null> | null = null;
  const getSuppliers = () => (suppliers ??= loadSuppliers(input.tenantId));
  let counter = 0;
  const result = await runAssistant({
    messages: input.messages,
    language: input.language,
    today,
    canManage: input.canManage,
    shopName: await shopName(input.tenantId),
    complete: input.complete ?? openAiCompletion,
    runTool: readTools(input.tenantId, input.language, getReport, getSuppliers),
    proposalContext: async (): Promise<ProposalContext> => {
      const [currentReport, currentSuppliers, settings] = await Promise.all([getReport(), getSuppliers(), loadInventorySettings(input.tenantId)]);
      return {
        report: currentReport, suppliers: currentSuppliers ?? [], productSuppliers: settings.productSuppliers, language: input.language, today, newId: () => `${input.requestId}-${(counter += 1)}`,
        waitlistFor: async (variantKey) => {
          const waitlist = await loadWaitlist(input.tenantId, currentReport, variantKey);
          return waitlist ? { waitlist, draft: await waitlistDraft(input.tenantId, waitlist.variant) } : null;
        },
      };
    },
  });
  // Scale includes Milo: recorded for the limit and the books, never charged.
  await recordAiUsage({ tenantId: input.tenantId, operation: "inventory_assistant", model: ASSISTANT_MODEL, usage: result.usage, idempotencyKey: `vera:${input.userId}:${input.requestId}`, billable: false, reason: "scale_included" });
  return result;
}
