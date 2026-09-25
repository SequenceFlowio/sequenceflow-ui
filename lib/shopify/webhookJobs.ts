import { loadCommerceConnection } from "@/lib/commerce/connections";
import { upsertCommerceOrder } from "@/lib/commerce/repository";
import { ShopifyAdapter } from "@/lib/commerce/shopify";
import { getResendClient } from "@/lib/email/outbound/resendClient";
import { decryptSecret } from "@/lib/security/credentials";
import { getShopifyOfflineAccess } from "@/lib/shopify/installations";
import {
  deleteShopifyDataForTenant,
  deleteShopifyWorkspace,
  exportShopifyCustomerData,
  redactShopifyCustomer,
} from "@/lib/shopify/privacy";
import {
  parseCustomerPrivacyPayload,
  parseOrderWebhookGid,
  planShopRedaction,
  SHOPIFY_ORDER_TOPICS,
  SHOPIFY_WEBHOOK_MAX_ATTEMPTS,
  SHOPIFY_WEBHOOK_STALE_MS,
  webhookNeedsAllowedShop,
} from "@/lib/shopify/webhookPolicy";
import { assertShopifyShopAllowed } from "@/lib/shopify/config";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Processes the webhooks that /api/shopify/webhooks stored durably. Receipt
 * and processing are separate, so Shopify always gets a fast answer and a
 * failed step is retried instead of lost.
 */

type Job = { id: string; shop_domain: string; topic: string; event_id: string; payload_encrypted: string; attempts: number };
type Install = { shop_domain: string; tenant_id: string | null; status: string; tenant_origin: string | null };

const PRIVACY_FALLBACK_CONTACT = () => process.env.SHOPIFY_PRIVACY_CONTACT_EMAIL || "hallo@sequenceflow.io";

async function loadInstall(shop: string): Promise<Install | null> {
  const { data, error } = await getSupabaseAdmin().from("shopify_installations")
    .select("shop_domain, tenant_id, status, tenant_origin").eq("shop_domain", shop).maybeSingle();
  if (error) throw new Error(`Could not load Shopify installation: ${error.message}`);
  return data as Install | null;
}

async function claimJobs(limit: number) {
  const db = getSupabaseAdmin();
  const staleBefore = new Date(Date.now() - SHOPIFY_WEBHOOK_STALE_MS).toISOString();
  const { data, error } = await db.from("shopify_webhook_jobs")
    .select("id, shop_domain, topic, event_id, payload_encrypted, attempts")
    .or(`status.in.(pending,failed),and(status.eq.processing,claimed_at.lt.${staleBefore})`)
    .lt("attempts", SHOPIFY_WEBHOOK_MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Could not load Shopify webhook jobs: ${error.message}`);
  const claimed: Job[] = [];
  for (const job of (data ?? []) as Job[]) {
    // Optimistic claim: only one worker wins the attempts increment.
    const { data: won } = await db.from("shopify_webhook_jobs")
      .update({ status: "processing", attempts: job.attempts + 1, claimed_at: new Date().toISOString() })
      .eq("id", job.id).eq("attempts", job.attempts).select("id").maybeSingle();
    if (won) claimed.push({ ...job, attempts: job.attempts + 1 });
  }
  return claimed;
}

async function finish(job: Job, error: unknown) {
  const db = getSupabaseAdmin();
  if (!error) {
    // Personal data is not kept once the job is done.
    await db.from("shopify_webhook_jobs").update({ status: "completed", completed_at: new Date().toISOString(), payload_encrypted: "", last_error: null }).eq("id", job.id);
    return;
  }
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
  console.error("[shopify-webhook]", job.topic, job.shop_domain, message);
  await db.from("shopify_webhook_jobs").update({
    // Retried by claimJobs until SHOPIFY_WEBHOOK_MAX_ATTEMPTS; then it stays failed for inspection.
    status: "failed",
    last_error: message,
  }).eq("id", job.id);
}

async function handleOrder(job: Job, payload: unknown) {
  const install = await loadInstall(job.shop_domain);
  if (!install || install.status !== "active" || !install.tenant_id) return;
  const gid = parseOrderWebhookGid(payload);
  if (!gid) return;
  const connection = await loadCommerceConnection(install.tenant_id, false, "shopify");
  if (!connection || connection.shopDomain !== job.shop_domain) return;
  // The webhook is only a signal; the order itself is read fresh from Shopify.
  const order = await new ShopifyAdapter().getOrder(connection, gid);
  if (order) await upsertCommerceOrder(connection, order);
}

async function shopContactEmail(shop: string) {
  try {
    const { accessToken } = await getShopifyOfflineAccess(shop);
    const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify({ query: "{ shop { name email contactEmail } }" }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    const data = result?.data?.shop;
    const email = data?.contactEmail || data?.email;
    return typeof email === "string" && email.includes("@") ? { email, name: String(data?.name ?? shop) } : null;
  } catch {
    return null;
  }
}

async function handleDataRequest(job: Job, payload: unknown) {
  const install = await loadInstall(job.shop_domain);
  const { customerEmail, orderGids } = parseCustomerPrivacyPayload(payload);
  const exportData = install?.tenant_id
    ? await exportShopifyCustomerData(install.tenant_id, customerEmail, orderGids)
    : { generatedAt: new Date().toISOString(), customerEmail, requestedOrders: orderGids, supportConversations: [], cachedOrderContext: [] };
  const contact = await shopContactEmail(job.shop_domain);
  const to = contact?.email ?? PRIVACY_FALLBACK_CONTACT();
  const empty = exportData.supportConversations.length === 0 && exportData.cachedOrderContext.length === 0;
  await getResendClient().emails.send({
    from: "SequenceFlow Support <noreply@mail.sequenceflow.io>",
    to,
    subject: `Gegevensverzoek van een klant · ${job.shop_domain}`,
    text: [
      contact ? `Hallo ${contact.name},` : `Handmatig doorsturen naar ${job.shop_domain}: het contactadres van de winkel was niet bereikbaar.`,
      "",
      `Via Shopify vroeg een klant${customerEmail ? ` (${customerEmail})` : ""} welke gegevens SequenceFlow Support over hem of haar bewaart.`,
      empty
        ? "SequenceFlow Support bewaart geen gegevens van deze klant."
        : "In de bijlage staan alle gegevens die SequenceFlow Support van deze klant bewaart: supportgesprekken en de bestelgegevens die bij klantvragen zijn gebruikt.",
      "",
      "Stuur deze gegevens door aan de klant. Vragen? Mail hallo@sequenceflow.io.",
    ].join("\n"),
    attachments: empty ? undefined : [{ filename: "klantgegevens.json", content: Buffer.from(JSON.stringify(exportData, null, 2)).toString("base64") }],
  });
}

async function handleCustomerRedact(job: Job, payload: unknown) {
  const install = await loadInstall(job.shop_domain);
  if (!install?.tenant_id) return;
  const { customerEmail, orderGids } = parseCustomerPrivacyPayload(payload);
  await redactShopifyCustomer(install.tenant_id, customerEmail, orderGids);
}

async function handleShopRedact(job: Job) {
  const install = await loadInstall(job.shop_domain);
  const plan = planShopRedaction(install);
  if (plan === "delete_workspace") await deleteShopifyWorkspace(install!.tenant_id!);
  if (plan === "delete_shopify_data") await deleteShopifyDataForTenant(install!.tenant_id!);
  if (plan === "delete_workspace" || plan === "delete_shopify_data" || plan === "nothing_stored") {
    const db = getSupabaseAdmin();
    await db.from("shopify_installations").delete().eq("shop_domain", job.shop_domain).neq("status", "active");
    // Earlier receipts for this shop may still hold personal data.
    await db.from("shopify_webhook_jobs").update({ payload_encrypted: "" }).eq("shop_domain", job.shop_domain).neq("id", job.id);
  }
}

export async function processShopifyWebhookJobs(limit = 20) {
  const jobs = await claimJobs(limit);
  const result = { processed: 0, failed: 0 };
  for (const job of jobs) {
    let failure: unknown = null;
    try {
      if (webhookNeedsAllowedShop(job.topic)) {
        try { assertShopifyShopAllowed(job.shop_domain); } catch { await finish(job, null); result.processed += 1; continue; }
      }
      const payload = job.payload_encrypted ? JSON.parse(decryptSecret(job.payload_encrypted)) : null;
      if (SHOPIFY_ORDER_TOPICS.has(job.topic)) await handleOrder(job, payload);
      else if (job.topic === "customers/data_request") await handleDataRequest(job, payload);
      else if (job.topic === "customers/redact") await handleCustomerRedact(job, payload);
      else if (job.topic === "shop/redact") await handleShopRedact(job);
      // app/uninstalled is handled on receipt; nothing left to do.
    } catch (error) {
      failure = error;
    }
    await finish(job, failure);
    if (failure) result.failed += 1; else result.processed += 1;
  }
  return result;
}
