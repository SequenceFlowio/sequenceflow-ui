import { NextResponse } from "next/server";
import Stripe from "stripe";

import { hasValidCronSecret } from "@/lib/auth/cron";
import { alertBudget } from "@/lib/billing/budgetAlerts";
import { budgetLevel, HANDLED_PRICING, includedHandled, ledgerStatuses, METER_EVENT, type ReplyKind } from "@/lib/billing/handledConversations";
import { loadConversationResults } from "@/lib/billing/handledLoader";
import { currentUsagePeriodStart } from "@/lib/billingPlans";
import { reportShopifyUsage } from "@/lib/shopify/appEvents";
import { billingOverrideForShop } from "@/lib/shopify/billingOverride";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Elk uur: gesprekken die definitief zijn afgehandeld komen in het register,
 * en wat op de factuur hoort gaat als meter-event naar Stripe.
 *
 * Factureren staat pas aan met STRIPE_USAGE_BILLING=on. Tot die tijd wordt
 * alles alleen vastgelegd (status not_billed).
 */
const PAID = ["starter", "pro", "agency", "custom"];
const MAX_PAST_SECONDS = 34 * 24 * 60 * 60; // Stripe neemt events tot 35 dagen terug aan.

export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const billingOn = process.env.STRIPE_USAGE_BILLING === "on" && Boolean(process.env.STRIPE_SECRET_KEY);
  // Shopify-winkels betalen via Shopify App Pricing (meters per plan). Uit met SHOPIFY_USAGE_BILLING=off.
  const shopifyOn = process.env.SHOPIFY_USAGE_BILLING !== "off" && Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
  let recorded = 0;
  let reported = 0;
  const failures: string[] = [];

  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("id, plan, stripe_customer_id, stripe_subscription_id, billing_period_start, usage_budget_cents")
    .in("plan", ["trial", ...PAID]);
  if (tenantsError) return NextResponse.json({ error: tenantsError.message }, { status: 500 });

  // Betalende Shopify-installaties (geen testwinkels met een vaste override).
  const { data: installs, error: installsError } = await supabase
    .from("shopify_installations")
    .select("tenant_id, shop_domain, shop_id, billing_plan")
    .eq("status", "active")
    .is("uninstalled_at", null);
  if (installsError) return NextResponse.json({ error: installsError.message }, { status: 500 });
  const shopifyPaid = new Map<string, { shopId: string; plan: string }>();
  for (const install of installs ?? []) {
    if (!install.tenant_id || !install.shop_id || !PAID.includes(install.billing_plan as string)) continue;
    if (billingOverrideForShop(install.shop_domain as string, process.env.SHOPIFY_BILLING_TEST_SHOPS)) continue;
    shopifyPaid.set(install.tenant_id as string, { shopId: String(install.shop_id), plan: install.billing_plan as string });
  }

  for (const tenant of tenants ?? []) {
    try {
      const start = new Date(currentUsagePeriodStart(tenant.billing_period_start, now));
      const handled = (await loadConversationResults(tenant.id, start, now))
        .filter((item) => item.result.status === "handled")
        .map((item) => ({ conversationId: item.conversationId, ...(item.result as Extract<typeof item.result, { status: "handled" }>) }))
        .sort((a, b) => Date.parse(a.finalAt) - Date.parse(b.finalAt));
      if (!handled.length) continue;

      const { data: known, error: knownError } = await supabase
        .from("billing_handled_conversations")
        .select("conversation_id")
        .in("conversation_id", handled.map((item) => item.conversationId));
      if (knownError) throw new Error(knownError.message);
      const seen = new Set((known ?? []).map((row) => row.conversation_id as string));
      const fresh = handled.filter((item) => !seen.has(item.conversationId));
      if (!fresh.length) continue;

      const { data: period, error: periodError } = await supabase
        .from("billing_handled_conversations")
        .select("rate_cents, status")
        .eq("tenant_id", tenant.id)
        .in("status", ["included", "pending_report", "reported"])
        .gte("final_at", start.toISOString());
      if (periodError) throw new Error(periodError.message);
      const charged = (period ?? []).filter((row) => row.status !== "included");
      const includedUsed = (period ?? []).length - charged.length;

      const statuses = ledgerStatuses(fresh.map((item) => item.rateCents), {
        billable: (billingOn && PAID.includes(tenant.plan) && Boolean(tenant.stripe_customer_id && tenant.stripe_subscription_id))
          || (shopifyOn && shopifyPaid.has(tenant.id)),
        alreadyThisPeriodCents: charged.reduce((sum, row) => sum + (row.rate_cents as number), 0),
        budgetCents: tenant.usage_budget_cents ?? null,
        includedLeft: includedHandled(shopifyPaid.get(tenant.id)?.plan ?? tenant.plan) - includedUsed,
      });
      const { error: insertError } = await supabase.from("billing_handled_conversations").upsert(
        fresh.map((item, index) => ({
          tenant_id: tenant.id,
          conversation_id: item.conversationId,
          kind: item.kind,
          rate_cents: item.rateCents,
          pricing_version: HANDLED_PRICING.version,
          sent_at: item.sentAt,
          final_at: item.finalAt,
          status: statuses[index],
          stripe_customer_id: tenant.stripe_customer_id ?? null,
        })),
        { onConflict: "conversation_id", ignoreDuplicates: true },
      );
      if (insertError) throw new Error(insertError.message);
      recorded += fresh.length;

      // Seintje bij 80% en 100% van het budget (per niveau en periode één keer).
      if (tenant.usage_budget_cents !== null && tenant.usage_budget_cents !== undefined) {
        const already = charged.reduce((sum, row) => sum + (row.rate_cents as number), 0);
        const added = fresh.reduce((sum, item, index) => sum + (statuses[index] === "pending_report" ? item.rateCents : 0), 0);
        const level = budgetLevel(already + added, tenant.usage_budget_cents);
        const reachedNow = statuses.includes("over_budget") ? "reached" : level;
        if (reachedNow !== "none") await alertBudget({ tenantId: tenant.id, level: reachedNow, periodStart: start.toISOString(), usedCents: already + added, budgetCents: tenant.usage_budget_cents });
      }
    } catch (error) {
      failures.push(`${tenant.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (billingOn || shopifyOn) {
    const stripe = billingOn ? new Stripe(process.env.STRIPE_SECRET_KEY!) : null;
    const { data: pending, error: pendingError } = await supabase
      .from("billing_handled_conversations")
      .select("id, tenant_id, kind, final_at, stripe_customer_id")
      .eq("status", "pending_report")
      .order("final_at")
      .limit(500);
    if (pendingError) failures.push(`pending: ${pendingError.message}`);
    const markReported = async (id: string) => {
      const { error: updateError } = await supabase
        .from("billing_handled_conversations")
        .update({ status: "reported", reported_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);
      reported += 1;
    };
    for (const row of pending ?? []) {
      const shop = shopifyPaid.get(row.tenant_id as string);
      try {
        if (row.stripe_customer_id && stripe) {
          const nowSeconds = Math.floor(now.getTime() / 1000);
          const timestamp = Math.max(Math.floor(Date.parse(row.final_at as string) / 1000), nowSeconds - MAX_PAST_SECONDS);
          // Het id van de registerregel is de sleutel: een herhaalde poging telt niet dubbel.
          await stripe.billing.meterEvents.create({
            event_name: METER_EVENT[row.kind as ReplyKind],
            payload: { stripe_customer_id: row.stripe_customer_id as string, value: "1" },
            identifier: row.id as string,
            timestamp: Math.min(timestamp, nowSeconds),
          });
          await markReported(row.id as string);
        } else if (!row.stripe_customer_id && shop && shopifyOn) {
          // Shopify bewaart idempotency-sleutels voor billing events permanent.
          await reportShopifyUsage({ shopId: shop.shopId, handle: row.kind === "ai_autonomous" ? "handled_autonomous" : "handled_assisted", idempotencyKey: row.id as string });
          await markReported(row.id as string);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Stripe kent dit event al (een eerdere poging kwam aan maar de update hier niet): dan staat het op de factuur.
        if (message.includes("already exists with identifier")) {
          await markReported(row.id as string).catch(() => {});
          continue;
        }
        failures.push(`report ${row.id}: ${message}`);
      }
    }
  }

  if (failures.length) console.error("[cron/handled-usage]", failures);
  return NextResponse.json({ billingOn, shopifyOn, recorded, reported, failures: failures.length });
}
