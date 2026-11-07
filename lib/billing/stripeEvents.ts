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
  for (const [key, plan] of [["STARTER", "starter"], ["PRO", "pro"], ["AGENCY", "agency"]] as const) {
    const known = [env[`STRIPE_PRICE_${key}`], ...(env[`STRIPE_PRICE_${key}_LEGACY`] ?? "").split(",")];
    if (known.some(id => id?.trim() === priceId)) return plan;
  }
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
/** The plan price among a subscription's items; other items (usage, add-ons) can come first. */
export function planPriceId(priceIds: (string | null | undefined)[], env: Record<string, string | undefined> = process.env): string | null {
  return priceIds.find((id): id is string => Boolean(planFromPriceId(id, env))) ?? null;
}

export function invoiceSubscriptionPrice(invoice: Stripe.Invoice, env: Record<string, string | undefined> = process.env): { priceId: string | null; subscriptionId: string | null } {
  const lines = invoice.lines?.data ?? [];
  const linePrice = (line: Stripe.InvoiceLineItem) => line.pricing?.price_details?.price;
  const subscriptionLine = lines.find((line) => line.parent?.type === "subscription_item_details" && line.parent.subscription_item_details?.subscription && planFromPriceId(typeof linePrice(line) === "string" ? linePrice(line) as string : null, env))
    ?? lines.find((line) => line.parent?.type === "subscription_item_details" && line.parent.subscription_item_details?.subscription)
    ?? lines.find((line) => line.parent?.type === "subscription_item_details")
    ?? lines[0];
  const details = subscriptionLine?.parent?.subscription_item_details;
  const subscriptionId = typeof details?.subscription === "string" ? details.subscription : null;
  const priceId = subscriptionLine?.pricing?.price_details?.price ?? null;
  return { priceId: typeof priceId === "string" ? priceId : null, subscriptionId };
}
