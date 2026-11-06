import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordInvoiceRewards, reverseRewardsForPayment } from "@/lib/referrals/server";
import { checkoutPlan, invoiceSubscriptionPrice, planFromPriceId, planPriceId, subscriptionPeriodStart } from "@/lib/billing/stripeEvents";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripeKey     = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const body   = await req.text();
  const sig    = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[billing/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Stripe delivers an event more than once now and then; only the first
  // delivery does work (migration 064). A failed insert is not worth a retry
  // storm from Stripe, so it is logged and the event is processed anyway.
  // If processing then fails, the registration is removed again and Stripe
  // gets a 500, so its retry is processed instead of skipped as a duplicate.
  const { data: firstDelivery, error: registerError } = await supabase
    .from("stripe_webhook_events")
    .upsert({ event_id: event.id, type: event.type }, { onConflict: "event_id", ignoreDuplicates: true })
    .select("event_id");
  if (registerError) {
    console.error("[billing/webhook] could not register event:", registerError.message);
  } else if (!firstDelivery?.length) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event, stripe, supabase);
  } catch (error) {
    console.error(`[billing/webhook] processing ${event.type} ${event.id} failed:`, error);
    if (!registerError) {
      const { error: releaseError } = await supabase.from("stripe_webhook_events").delete().eq("event_id", event.id);
      if (releaseError) console.error("[billing/webhook] could not release event for retry:", releaseError.message);
    }
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type Supabase = ReturnType<typeof getSupabaseAdmin>;

/** A database write that fails must fail the event, so Stripe sends it again. */
function must(result: { error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}

async function handleEvent(event: Stripe.Event, stripe: Stripe, supabase: Supabase) {
  switch (event.type) {
    // First checkout: use metadata.tenant_id + metadata.plan for immediate activation
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const tenantId = session.metadata?.tenant_id;
      const plan     = checkoutPlan(session.metadata?.plan);
      if (!tenantId || !plan) {
        console.error(`[billing/webhook] checkout without a valid plan: tenant=${tenantId ?? "?"} plan=${String(session.metadata?.plan)}`);
        break;
      }
      must(await supabase
        .from("tenants")
        .update({ plan, stripe_customer_id: session.customer as string })
        .eq("id", tenantId), "activate checkout plan");
      console.log(`[webhook] checkout.session.completed: tenant=${tenantId} plan=${plan}`);
      break;
    }

    case "customer.subscription.updated":
    case "invoice.paid": {
      const obj = event.data.object as Stripe.Subscription | Stripe.Invoice;

      let customerId: string | null = null;
      let priceId:    string | null = null;
      let subId:      string | null = null;
      // Only a real period change (new subscription or renewal) moves the usage window.
      let periodStart: string | null = null;

      if (event.type === "customer.subscription.updated") {
        const sub  = obj as Stripe.Subscription;
        customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        // The plan item, not just the first one: a subscription can also carry
        // other items (usage, add-ons) in any order.
        priceId    = planPriceId(sub.items.data.map((item) => item.price?.id));
        subId      = sub.id;
        periodStart = subscriptionPeriodStart(sub);
      } else {
        const inv  = obj as Stripe.Invoice;
        customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as Stripe.Customer)?.id ?? null;
        const line = invoiceSubscriptionPrice(inv);
        priceId    = line.priceId;
        subId      = line.subscriptionId;
        const paidAt = inv.status_transitions?.paid_at;
        periodStart = inv.billing_reason === "subscription_cycle" || inv.billing_reason === "subscription_create"
          ? new Date((typeof paidAt === "number" ? paidAt : Math.floor(Date.now() / 1000)) * 1000).toISOString()
          : null;
      }

      if (!customerId || !priceId) break;

      const plan = planFromPriceId(priceId);
      if (!plan) break;

      must(await supabase
        .from("tenants")
        .update({
          plan,
          ...(subId ? { stripe_subscription_id: subId } : {}),
          ...(periodStart ? { billing_period_start: periodStart } : {}),
        })
        .eq("stripe_customer_id", customerId), "update plan");

      // Commissie voor de affiliate of tegoed voor de doorverwijzer (los van het plan: mag nooit de webhook breken)
      if (event.type === "invoice.paid") {
        try {
          await recordInvoiceRewards(stripe, obj as Stripe.Invoice);
        } catch (error) {
          console.error("[webhook] referral rewards failed:", error);
        }
      }

      break;
    }

    // Terugbetaald of chargeback: commissie en tegoed op die betaling vervallen
    case "charge.refunded":
    case "charge.dispute.created": {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute;
      const charge = event.type === "charge.refunded" ? (object as Stripe.Charge) : null;
      const dispute = event.type === "charge.dispute.created" ? (object as Stripe.Dispute) : null;
      const chargeId = charge?.id ?? (typeof dispute?.charge === "string" ? dispute.charge : dispute?.charge?.id);
      const intent = charge?.payment_intent ?? dispute?.payment_intent;
      try {
        await reverseRewardsForPayment([chargeId, typeof intent === "string" ? intent : intent?.id]);
      } catch (error) {
        console.error("[webhook] reversing referral rewards failed:", error);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub  = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      must(await supabase
        .from("tenants")
        .update({ plan: "expired", stripe_subscription_id: null })
        .eq("stripe_customer_id", customerId), "expire deleted subscription");

      console.log(`[webhook] subscription deleted for customer=${customerId}`);
      break;
    }

    // After Stripe exhausts retries, mark tenant as expired
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((inv as any).attempt_count < 4) break; // still retrying
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as Stripe.Customer)?.id ?? null;
      if (!customerId) break;
      must(await supabase
        .from("tenants")
        .update({ plan: "expired" })
        .eq("stripe_customer_id", customerId), "expire after failed payments");
      console.log(`[webhook] invoice.payment_failed (final): customer=${customerId} → expired`);
      break;
    }
  }
}
