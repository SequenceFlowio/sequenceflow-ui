import { NextResponse } from "next/server";
import Stripe from "stripe";

import { hasValidCronSecret } from "@/lib/auth/cron";
import { HANDLED_PRICING, ledgerStatuses, METER_EVENT, type ReplyKind } from "@/lib/billing/handledConversations";
import { loadConversationResults } from "@/lib/billing/handledLoader";
import { currentUsagePeriodStart } from "@/lib/billingPlans";
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
  let recorded = 0;
  let reported = 0;
  const failures: string[] = [];

  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("id, plan, stripe_customer_id, stripe_subscription_id, billing_period_start, usage_budget_cents")
    .in("plan", ["trial", ...PAID]);
  if (tenantsError) return NextResponse.json({ error: tenantsError.message }, { status: 500 });

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
        .select("rate_cents")
        .eq("tenant_id", tenant.id)
        .in("status", ["pending_report", "reported"])
        .gte("final_at", start.toISOString());
      if (periodError) throw new Error(periodError.message);

      const statuses = ledgerStatuses(fresh.map((item) => item.rateCents), {
        billable: billingOn && PAID.includes(tenant.plan) && Boolean(tenant.stripe_customer_id && tenant.stripe_subscription_id),
        alreadyThisPeriodCents: (period ?? []).reduce((sum, row) => sum + (row.rate_cents as number), 0),
        budgetCents: tenant.usage_budget_cents ?? null,
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
    } catch (error) {
      failures.push(`${tenant.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (billingOn) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const { data: pending, error: pendingError } = await supabase
      .from("billing_handled_conversations")
      .select("id, kind, final_at, stripe_customer_id")
      .eq("status", "pending_report")
      .order("final_at")
      .limit(500);
    if (pendingError) failures.push(`pending: ${pendingError.message}`);
    for (const row of pending ?? []) {
      if (!row.stripe_customer_id) continue;
      try {
        const nowSeconds = Math.floor(now.getTime() / 1000);
        const timestamp = Math.max(Math.floor(Date.parse(row.final_at as string) / 1000), nowSeconds - MAX_PAST_SECONDS);
        // Het id van de registerregel is de sleutel: een herhaalde poging telt niet dubbel.
        await stripe.billing.meterEvents.create({
          event_name: METER_EVENT[row.kind as ReplyKind],
          payload: { stripe_customer_id: row.stripe_customer_id as string, value: "1" },
          identifier: row.id as string,
          timestamp: Math.min(timestamp, nowSeconds),
        });
        const { error: updateError } = await supabase
          .from("billing_handled_conversations")
          .update({ status: "reported", reported_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updateError) throw new Error(updateError.message);
        reported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Stripe kent dit event al (een eerdere poging kwam aan maar de update hier niet): dan staat het op de factuur.
        if (message.includes("already exists with identifier")) {
          await supabase.from("billing_handled_conversations").update({ status: "reported", reported_at: new Date().toISOString() }).eq("id", row.id);
          reported += 1;
          continue;
        }
        failures.push(`report ${row.id}: ${message}`);
      }
    }
  }

  if (failures.length) console.error("[cron/handled-usage]", failures);
  return NextResponse.json({ billingOn, recorded, reported, failures: failures.length });
}
