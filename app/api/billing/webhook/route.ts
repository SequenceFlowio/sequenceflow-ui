import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const STRIPE_PLAN_MAP: Record<string, string> = {};

function getPlanFromPriceId(priceId: string): string | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO)     return "pro";
  if (priceId === process.env.STRIPE_PRICE_AGENCY)  return "agency";
  return null;
}

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

  switch (event.type) {
    // First checkout: use metadata.tenant_id + metadata.plan for immediate activation
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const tenantId = session.metadata?.tenant_id;
      const plan     = session.metadata?.plan;
      if (!tenantId || !plan) break;
      await supabase
        .from("tenants")
        .update({ plan, stripe_customer_id: session.customer as string })
        .eq("id", tenantId);
      console.log(`[webhook] checkout.session.completed: tenant=${tenantId} plan=${plan}`);
      break;
    }

    case "customer.subscription.updated":
    case "invoice.paid": {
      const obj = event.data.object as Stripe.Subscription | Stripe.Invoice;

      let customerId: string | null = null;
      let priceId:    string | null = null;
      let subId:      string | null = null;

      if (event.type === "customer.subscription.updated") {
        const sub  = obj as Stripe.Subscription;
        customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        priceId    = sub.items.data[0]?.price?.id ?? null;
        subId      = sub.id;
      } else {
        const inv  = obj as Stripe.Invoice;
        customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as Stripe.Customer)?.id ?? null;
        const lines = inv.lines?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priceId    = (lines[0] as any)?.price?.id ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subId      = typeof (inv as any).subscription === "string" ? (inv as any).subscription : null;
      }

      if (!customerId || !priceId) break;

      const plan = getPlanFromPriceId(priceId);
      if (!plan) break;

      await supabase
        .from("tenants")
        .update({
          plan,
          stripe_subscription_id: subId,
          billing_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        })
        .eq("stripe_customer_id", customerId);

      break;
    }

    case "customer.subscription.deleted": {
      const sub  = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      await supabase
        .from("tenants")
        .update({ plan: "expired", stripe_subscription_id: null })
        .eq("stripe_customer_id", customerId);

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
      await supabase
        .from("tenants")
        .update({ plan: "expired" })
        .eq("stripe_customer_id", customerId);
      console.log(`[webhook] invoice.payment_failed (final): customer=${customerId} → expired`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
