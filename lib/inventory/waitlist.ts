import { sendTenantEmail } from "@/lib/email/outbound/mailer";
import { shopDay, variantLabel } from "@/lib/inventory/core";
import { waitlistConversationIds } from "@/lib/inventory/questionsCore";
import type { InventoryReport } from "@/lib/inventory/reportCore";
import { loadQuestionConversations, loadVariants } from "@/lib/inventory/sync";
import { buildWaitlist, personalize, waitlistEmail, type Waitlist } from "@/lib/inventory/waitlistCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The waitlist against the database: who asked when a variant would be back,
 * who was already mailed, and the send itself (from the shop's own mailbox,
 * one mail per customer per variant, only after the merchant confirmed).
 */

/** Missing table (migration 063 not run yet). */
export function waitlistUnavailable(error: { message?: string; code?: string } | null) {
  return Boolean(error && (error.code === "42P01" || /inventory_waitlist_sends|schema cache/i.test(error.message ?? "")));
}

export async function loadWaitlist(tenantId: string, report: InventoryReport, variantKey: string, now = new Date()): Promise<Waitlist | null> {
  const metric = report.metrics.find((row) => row.variantKey === variantKey);
  if (!metric) return null;
  const db = getSupabaseAdmin();
  const variants = await loadVariants(tenantId);
  const conversations = await loadQuestionConversations(tenantId, variants, shopDay(now));
  const ids = waitlistConversationIds(conversations, variants.map((row) => ({ variantKey: row.variant_key, productKey: row.product_external_id ? `${row.provider}:${row.product_external_id}` : `title:${row.product_title.trim().toLowerCase()}`, productTitle: row.product_title, options: row.options ?? {} })), variantKey);
  if (!ids.length) return buildWaitlist({ variantKey, variant: variantLabel(metric), stock: metric.stock, rows: [], sent: [] });
  const [{ data: rows, error }, { data: sent, error: sentError }] = await Promise.all([
    db.from("support_conversations").select("id,customer_email,customer_name,created_at").eq("tenant_id", tenantId).in("id", ids.slice(0, 500)).order("created_at", { ascending: false }),
    db.from("inventory_waitlist_sends").select("customer_email,sent_at").eq("tenant_id", tenantId).eq("variant_key", variantKey),
  ]);
  if (error) throw new Error(error.message);
  if (sentError) throw Object.assign(new Error(sentError.message), { code: sentError.code });
  return buildWaitlist({
    variantKey, variant: variantLabel(metric), stock: metric.stock,
    rows: (rows ?? []).map((row) => ({ conversationId: row.id as string, email: row.customer_email as string | null, name: row.customer_name as string | null })),
    sent: (sent ?? []).map((row) => ({ email: row.customer_email as string, sentAt: row.sent_at as string })),
  });
}

/** Variants that came back in stock in the last two weeks and have people waiting, without addresses. */
export function waitlistCandidates(report: InventoryReport) {
  const recent = shopDay(new Date(Date.now() - 14 * 86_400_000));
  return report.metrics
    .filter((metric) => (metric.questions?.topics?.availability ?? 0) > 0 && (metric.stock ?? 0) > 0 && report.deliveries.some((delivery) => delivery.variantKey === metric.variantKey && !delivery.upcoming && delivery.day >= recent))
    .map((metric) => ({ variantKey: metric.variantKey, variant: variantLabel(metric), stock: metric.stock, askedWhenBack: metric.questions?.topics?.availability ?? 0 }))
    .sort((a, b) => b.askedWhenBack - a.askedWhenBack);
}

async function shopIdentity(tenantId: string) {
  const db = getSupabaseAdmin();
  const [{ data: connection }, { data: config }] = await Promise.all([
    db.from("commerce_connections").select("display_name,shop_domain").eq("tenant_id", tenantId).eq("status", "active").order("created_at").limit(1).maybeSingle(),
    db.from("tenant_agent_config").select("language_default").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  // A WooCommerce domain is the shop; a myshopify.com address is not what customers know.
  const domain = ((connection?.shop_domain as string | null) ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const shopUrl = domain && !/myshopify\.com$/i.test(domain) && !/bol\.com/i.test(domain) ? `https://${domain}` : null;
  return { shopName: (connection?.display_name as string | null) ?? null, shopUrl, language: config?.language_default === "en" ? "en" as const : "nl" as const };
}

/** The draft the merchant sees before confirming. */
export async function waitlistDraft(tenantId: string, variant: string) {
  const identity = await shopIdentity(tenantId);
  return { ...waitlistEmail({ variant, shopName: identity.shopName, shopUrl: identity.shopUrl, language: identity.language }), language: identity.language };
}

/** Sends to everyone on the list who was not mailed before, from the shop's mailbox, and remembers it. */
export async function sendWaitlist(input: { tenantId: string; report: InventoryReport; variantKey: string; subject: string; text: string; userId: string | null }) {
  const waitlist = await loadWaitlist(input.tenantId, input.report, input.variantKey);
  if (!waitlist) throw new Error("Unknown variant.");
  const identity = await shopIdentity(input.tenantId);
  const db = getSupabaseAdmin();
  let sent = 0;
  const failed: string[] = [];
  let skipped = 0;
  for (const customer of waitlist.customers) {
    if (customer.sentAt) continue;
    // Claim first, send second: two admins clicking at once, or a retry after a
    // timeout, must never mail the same customer twice. The unique key keeps
    // one claim; the loser sees nothing inserted and skips.
    const { data: claimed, error: claimError } = await db.from("inventory_waitlist_sends")
      .upsert({ tenant_id: input.tenantId, variant_key: input.variantKey, customer_email: customer.email, conversation_id: customer.conversationId, sent_by: input.userId }, { onConflict: "tenant_id,variant_key,customer_email", ignoreDuplicates: true })
      .select("id");
    if (claimError) throw Object.assign(new Error(claimError.message), { code: claimError.code });
    if (!claimed?.length) { skipped += 1; continue; }
    try {
      await sendTenantEmail({ tenantId: input.tenantId, to: customer.email, subject: input.subject, text: personalize(input.text, customer.name, identity.language), fromName: identity.shopName });
      sent += 1;
    } catch (error) {
      // The mail did not go out: release the claim so a later attempt can try again.
      await db.from("inventory_waitlist_sends").delete().eq("tenant_id", input.tenantId).eq("variant_key", input.variantKey).eq("customer_email", customer.email)
        .then(({ error: releaseError }) => { if (releaseError) console.error("[inventory/waitlist/release]", customer.email, releaseError.message); });
      console.error("[inventory/waitlist/send]", customer.email, error instanceof Error ? error.message : error);
      failed.push(customer.email);
    }
  }
  return { sent, failed, skipped, total: waitlist.customers.length };
}
