import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { basePriceEnvKey } from "@/lib/billingInterval";

import { getTenantPlanAccess, SHOPIFY_BILLING_MESSAGE } from "@/lib/billing";
import { planPriceId } from "@/lib/billing/stripeEvents";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * Van pakket wisselen binnen een lopend abonnement. Alleen de regel met het
 * vaste bedrag wisselt; de gebruiksregels blijven staan. Het verschil wordt
 * naar rato verrekend. Het plan in de database volgt via de webhook.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId, role } = await getTenantId(req);
    if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const access = await getTenantPlanAccess(tenantId);
    if (access.billingSource === "shopify") return NextResponse.json({ error: SHOPIFY_BILLING_MESSAGE, useShopify: true }, { status: 409 });

    const { plan, interval = "month" } = await req.json();
    if (interval !== "month" && interval !== "year") return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    const key = basePriceEnvKey(plan, interval);
    const newPrice = key ? process.env[key] : undefined;
    if (!newPrice) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

    const { data: tenant } = await getSupabaseAdmin().from("tenants").select("stripe_subscription_id").eq("id", tenantId).single();
    const subscriptionId = tenant?.stripe_subscription_id as string | undefined;
    if (!subscriptionId) return NextResponse.json({ error: "No subscription", useCheckout: true }, { status: 409 });

    const stripe = new Stripe(stripeKey);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const basePrice = planPriceId(subscription.items.data.map((item) => item.price?.id));
    const baseItem = subscription.items.data.find((item) => item.price?.id === basePrice);
    if (!baseItem) return NextResponse.json({ error: "Plan item not found" }, { status: 409 });

    if (baseItem.price.id === newPrice) return NextResponse.json({ ok: true, unchanged: true });
    if (interval === "year" && subscription.billing_mode?.type !== "flexible") {
      await stripe.subscriptions.migrate(subscriptionId, { billing_mode: { type: "flexible" } });
    }
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: baseItem.id, price: newPrice, quantity: 1 }],
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Not authenticated") return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    console.error("[billing/change-plan]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
