import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const PRICE_MAP: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  agency:  process.env.STRIPE_PRICE_AGENCY,
};

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan } = await req.json();

    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://emailreply.sequenceflow.io";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings?tab=billing&checkout=success`,
      cancel_url:  `${baseUrl}/settings?tab=billing&checkout=cancelled`,
      metadata: { tenant_id: tenantId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
