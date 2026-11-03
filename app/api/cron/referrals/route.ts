import { NextResponse } from "next/server";
import Stripe from "stripe";

import { settleDueRewards } from "@/lib/referrals/server";
import { hasValidCronSecret } from "@/lib/auth/cron";

export const runtime = "nodejs";


/** Dagelijks: commissies na 60 dagen uitbetaalbaar, tegoed voor doorverwijzers na 30 dagen op hun Stripe-saldo. */
export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const result = await settleDueRewards(stripeKey ? new Stripe(stripeKey) : null);
  return NextResponse.json({ ok: true, ...result });
}
