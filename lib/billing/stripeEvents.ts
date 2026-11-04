import type Stripe from "stripe";

/**
 * Pure helpers for the Stripe webhook, so the decisions can be tested
 * without HTTP or a database.
 */

export const PAID_PLANS = new Set(["starter", "pro", "agency"]);

export function planFromPriceId(
  priceId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === env.STRIPE_PRICE_AGENCY) return "agency";
  return null;
}

/** Only a plan we sell may land in tenants.plan, whatever the metadata says. */
export function checkoutPlan(metadataPlan: unknown): string | null {
  return typeof metadataPlan === "string" && PAID_PLANS.has(metadataPlan) ? metadataPlan : null;
}

/** First day of the current period as an ISO string, from the subscription's own period. */
export function subscriptionPeriodStart(subscription: Stripe.Subscription, now = new Date()): string {
  const item = subscription.items?.data?.[0];
  const seconds = item?.current_period_start;
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000).toISOString();
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * The price on the subscription line of an invoice. A proration or a one-off
 * item can sit first in `lines`, so pick the line that belongs to the
 * subscription rather than `lines[0]`.
 */
export function invoiceSubscriptionPrice(invoice: Stripe.Invoice): { priceId: string | null; subscriptionId: string | null } {
  const lines = invoice.lines?.data ?? [];
  const subscriptionLine = lines.find((line) => line.parent?.type === "subscription_item_details" && line.parent.subscription_item_details?.subscription)
    ?? lines.find((line) => line.parent?.type === "subscription_item_details")
    ?? lines[0];
  const details = subscriptionLine?.parent?.subscription_item_details;
  const subscriptionId = typeof details?.subscription === "string" ? details.subscription : null;
  const priceId = subscriptionLine?.pricing?.price_details?.price ?? null;
  return { priceId: typeof priceId === "string" ? priceId : null, subscriptionId };
}
