import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { basePriceEnvKey } from "@/lib/billingInterval";
import { requestAppOrigin } from "@/lib/brand";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantPlanAccess, SHOPIFY_BILLING_MESSAGE } from "@/lib/billing";
import { applyNewCustomerCredit } from "@/lib/referrals/server";

export const runtime = "nodejs";

/**
 * Het gebruiksdeel: €0,47 per gecontroleerde en €0,97 per zelfstandige
 * afhandeling, als gemeten prijzen naast het vaste bedrag. Alleen als die
 * prijzen zijn ingesteld. Ook Starter krijgt beide: daar blijft zelfstandig
 * op nul staan, en bij een upgrade hoeft het abonnement niet om.
 */
const USAGE_BILLING = process.env.STRIPE_USAGE_BILLING === "on";

function usageLineItems(): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return [process.env.STRIPE_PRICE_HANDLED_ASSISTED, process.env.STRIPE_PRICE_HANDLED_AUTONOMOUS]
    .filter((price): price is string => Boolean(price))
    .map((price) => ({ price }));
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, role } = await getTenantId(req);
    if (role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    if ((await getTenantPlanAccess(tenantId)).billingSource === "shopify") {
      return NextResponse.json({ error: SHOPIFY_BILLING_MESSAGE, useShopify: true }, { status: 409 });
    }
    const { plan, interval = "month" } = await req.json();
    if (interval !== "month" && interval !== "year") return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    const key = basePriceEnvKey(plan, interval);
    const priceId = key ? process.env[key] : undefined;
    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (interval === "year" && (!process.env.STRIPE_PRICE_HANDLED_ASSISTED || !process.env.STRIPE_PRICE_HANDLED_AUTONOMOUS)) {
      return NextResponse.json({ error: "Annual billing is not configured" }, { status: 503 });
    }
    const { plan: currentPlan } = await getTenantPlanAccess(tenantId);
    if (["starter", "pro", "agency", "custom"].includes(currentPlan)) {
      return NextResponse.json(
        { error: "Existing subscriptions must be changed in the billing portal", usePortal: true },
        { status: 409 }
      );
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const stripe = new Stripe(stripeKey);
    const supabase = getSupabaseAdmin();

    // Get or create Stripe customer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", tenantId)
      .single();

    let customerId = tenant?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { tenant_id: tenantId },
      });
      customerId = customer.id;
      await supabase
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenantId);
    }

    // Doorverwezen klant: welkomsttegoed staat klaar vóór de eerste factuur
    try {
      await applyNewCustomerCredit(stripe, tenantId, customerId, plan);
    } catch (error) {
      console.error("[billing/checkout] referral credit failed:", error);
    }

    const baseUrl = requestAppOrigin(req.url);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }, ...(interval === "year" ? [] : usageLineItems())],
      // Nieuwe prijzen zijn exclusief btw: Stripe Tax rekent de btw uit (21% in
      // Nederland, verlegd voor zakelijke klanten elders in de EU met btw-nummer).
      ...(USAGE_BILLING
        ? {
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            billing_address_collection: "required" as const,
            customer_update: { address: "auto" as const, name: "auto" as const },
          }
        : {}),
      success_url: `${baseUrl}/settings?tab=billing&checkout=success`,
      cancel_url:  `${baseUrl}/settings?tab=billing&checkout=cancelled`,
      subscription_data: { billing_mode: { type: "flexible" }, metadata: { tenant_id: tenantId, plan, interval } },
      metadata: { tenant_id: tenantId, plan, interval },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
