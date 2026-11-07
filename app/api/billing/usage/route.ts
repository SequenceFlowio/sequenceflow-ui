import Stripe from "stripe";
import { planPriceId } from "@/lib/billing/stripeEvents";
import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getTenantPlan, PLAN_LIMITS } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { tenantId, role } = await getTenantId(req);
    const { plan, used, limit, trialEndsAt, billingSource } = await getTenantPlan(tenantId);

    const docLimit = PLAN_LIMITS[plan].docs;
    const memberLimit = PLAN_LIMITS[plan].members;
    const supabase = getSupabaseAdmin();
    const [{ count: docsCount }, { count: membersCount }, { data: tenant }] = await Promise.all([
      supabase
        .from("knowledge_documents")
        .select("id", { count: "exact", head: true })
        .eq("client_id", tenantId)
        .neq("status", "error"),
      supabase
        .from("tenant_members")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("tenants")
        .select("stripe_customer_id, stripe_subscription_id")
        .eq("id", tenantId)
        .single(),
    ]);

    let billingInterval: "month" | "year" = "month";
    if (billingSource !== "shopify" && tenant?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
      const baseId = planPriceId(subscription.items.data.map(item => item.price.id));
      billingInterval = subscription.items.data.find(item => item.price.id === baseId)?.price.recurring?.interval === "year" ? "year" : "month";
    }
    return NextResponse.json({
      billingInterval,
      plan,
      billingSource,
      used,
      limit: limit === Infinity ? null : limit,
      trialEndsAt,
      docsUsed: docsCount ?? 0,
      docsLimit: docLimit === Infinity ? null : docLimit,
      membersUsed: membersCount ?? 0,
      membersLimit: memberLimit === Infinity ? null : memberLimit,
      billingPortalAvailable: Boolean(tenant?.stripe_customer_id),
      canManage: role === "admin",
    });
  } catch (err) {
    console.error("[billing/usage]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
