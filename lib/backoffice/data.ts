import { unstable_cache } from "next/cache";
import Stripe from "stripe";

import { PAID_PLAN_CATALOG } from "@/lib/planCatalog";
import { AFFILIATE } from "@/lib/referrals/program";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { backofficeDemo } from "./auth";
import { demoData } from "./demo";
import { buildDashboard, DAY_MS, type RawData, type RawInvoice, type RawMarketingEvent, type RawOwner, type RawRefund, type RawSubscription } from "./metrics";

/**
 * Haalt alles op wat het beheerdashboard nodig heeft: werkruimtes en eigen
 * bezoekmeting uit Supabase, abonnementen en facturen uit Stripe. Alleen lezen.
 * Een bron die faalt levert een melding op het scherm op, geen kapotte pagina.
 */

const PAGE = 1000;
const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

async function all<T>(what: string, notes: string[], query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, max = 50_000) {
  const rows: T[] = [];
  try {
    for (let from = 0; from < max; from += PAGE) {
      const { data, error } = await query(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) break;
    }
  } catch (error) {
    console.error(`[backoffice] ${what} ophalen mislukt:`, error instanceof Error ? error.message : error);
    notes.push(`${what} kon niet worden opgehaald; cijfers die daarvan afhangen ontbreken.`);
  }
  return rows;
}

const CANCEL_REASONS: Record<string, string> = {
  cancellation_requested: "door de klant opgezegd", payment_failed: "betaling mislukt", payment_disputed: "betaling betwist",
  too_expensive: "te duur", missing_features: "mist functies", switched_service: "overgestapt", unused: "niet gebruikt",
  customer_service: "ontevreden over service", too_complex: "te ingewikkeld", low_quality: "kwaliteit viel tegen", other: "andere reden",
};

/** Vast maandbedrag van een abonnement; verbruik (per gesprek) telt niet mee, jaarbetaling gedeeld door 12. */
export function subscriptionMonthlyCents(items: Array<{ quantity?: number | null; price: { unit_amount: number | null; recurring: { interval: string; interval_count: number; usage_type: string } | null } }>) {
  return Math.round(items.reduce((sum, item) => {
    const recurring = item.price.recurring;
    if (!recurring || recurring.usage_type === "metered" || !item.price.unit_amount) return sum;
    const amount = item.price.unit_amount * (item.quantity ?? 1);
    const months = recurring.interval === "year" ? 12 * recurring.interval_count : recurring.interval === "month" ? recurring.interval_count : recurring.interval === "week" ? recurring.interval_count * (7 / 30.4375) : recurring.interval_count / 30.4375;
    return sum + amount / months;
  }, 0));
}

/** Wat er van een factuur binnenkwam, zonder btw. */
export function invoiceNetCents(invoice: { status: string | null; total: number; amount_paid: number; total_excluding_tax: number | null }) {
  const excluding = invoice.total_excluding_tax ?? invoice.total;
  if (invoice.status !== "paid") return Math.max(0, excluding);
  if (invoice.total <= 0) return 0;
  // Tegoed (bijvoorbeeld een doorverwijsbeloning) verlaagt wat er echt betaald is.
  return Math.max(0, Math.round(excluding * Math.min(1, invoice.amount_paid / invoice.total)));
}

async function loadStripe(notes: string[]) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    notes.push("Stripe is hier niet ingesteld (STRIPE_SECRET_KEY ontbreekt): omzet, betaaldata en opzeggingen ontbreken.");
    return { available: false, subscriptions: [] as RawSubscription[], invoices: [] as RawInvoice[], refunds: [] as RawRefund[] };
  }
  try {
    const stripe = new Stripe(key);
    const since = Math.floor((Date.now() - 400 * DAY_MS) / 1000);
    const [subscriptions, invoices, refunds] = await Promise.all([
      stripe.subscriptions.list({ status: "all", limit: 100 }).autoPagingToArray({ limit: 5000 }),
      stripe.invoices.list({ created: { gte: since }, limit: 100 }).autoPagingToArray({ limit: 10_000 }),
      stripe.refunds.list({ created: { gte: since }, limit: 100 }).autoPagingToArray({ limit: 2000 }),
    ]);
    return {
      available: true,
      subscriptions: subscriptions.map((sub): RawSubscription => ({
        id: sub.id,
        customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        status: sub.status,
        startedAt: iso(sub.start_date) ?? iso(sub.created)!,
        canceledAt: sub.status === "canceled" ? iso(sub.ended_at ?? sub.canceled_at) : null,
        cancelAt: sub.status !== "canceled" && (sub.cancel_at_period_end || sub.cancel_at) ? iso(sub.cancel_at ?? sub.items.data[0]?.current_period_end) : null,
        monthlyCents: subscriptionMonthlyCents(sub.items.data),
        reason: CANCEL_REASONS[sub.cancellation_details?.feedback ?? ""] ?? CANCEL_REASONS[sub.cancellation_details?.reason ?? ""] ?? null,
      })),
      invoices: invoices.filter((invoice) => invoice.status === "paid" || invoice.status === "open").map((invoice): RawInvoice => ({
        id: invoice.id ?? "",
        customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null,
        status: invoice.status ?? "",
        netCents: invoiceNetCents(invoice),
        createdAt: iso(invoice.created)!,
        paidAt: iso(invoice.status_transitions?.paid_at),
        reason: invoice.billing_reason,
        attempts: invoice.attempt_count,
      })),
      refunds: refunds.filter((refund) => refund.status === "succeeded").map((refund): RawRefund => ({ amountCents: refund.amount, createdAt: iso(refund.created)! })),
    };
  } catch (error) {
    console.error("[backoffice] Stripe ophalen mislukt:", error instanceof Error ? error.message : error);
    notes.push("Stripe was niet bereikbaar: omzet, betaaldata en opzeggingen ontbreken tijdelijk.");
    return { available: false, subscriptions: [] as RawSubscription[], invoices: [] as RawInvoice[], refunds: [] as RawRefund[] };
  }
}

async function loadOwners(notes: string[]) {
  const db = getSupabaseAdmin();
  const members = await all<{ tenant_id: string; user_id: string; role: string; created_at?: string }>("Teamleden", notes, (a, b) => db.from("tenant_members").select("tenant_id, user_id, role").range(a, b));
  const users = new Map<string, RawOwner>();
  try {
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE });
      if (error) throw new Error(error.message);
      for (const user of data.users) users.set(user.id, { email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null });
      if (data.users.length < PAGE) break;
    }
  } catch (error) {
    console.error("[backoffice] gebruikers ophalen mislukt:", error instanceof Error ? error.message : error);
    notes.push("E-mailadressen van klanten konden niet worden opgehaald.");
  }
  const owners: Record<string, RawOwner> = {};
  for (const member of members) {
    const user = users.get(member.user_id);
    // De beheerder van de werkruimte gaat voor; anders het eerste lid.
    if (user && (!owners[member.tenant_id] || member.role === "admin")) owners[member.tenant_id] = user;
  }
  return owners;
}

async function loadRaw(): Promise<RawData> {
  const notes: string[] = [];
  const db = getSupabaseAdmin();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS).toISOString();
  const since120 = new Date(now - 120 * DAY_MS).toISOString();

  type EventRow = { event_name: string; session_id: string; tenant_id: string | null; path: string; referrer: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; gclid: string | null; fbclid: string | null; metadata: { label?: string | null } | null; created_at: string };
  type AffiliateRow = { id: string; username: string; name: string; email: string; channel: string | null; status: string; is_business: boolean; created_at: string };
  type RewardRow = { id: string; kind: string; affiliate_id: string | null; referrer_tenant_id: string | null; referred_tenant_id: string; amount_cents: number; base_cents: number; rate: number | null; status: string; invoice_paid_at: string; available_at: string };
  type ShopRow = { tenant_id: string | null; shop_domain: string; status: string; installed_at: string | null; uninstalled_at: string | null };

  const [tenants, owners, stripe, events, affiliates, rewards, shopify, emailChannels, google, microsoft, decisions] = await Promise.all([
    all<RawData["tenants"][number]>("Werkruimtes", notes, (a, b) => db.from("tenants").select("id, name, plan, created_at, trial_ends_at, stripe_customer_id, stripe_subscription_id, referred_by_tenant_id, affiliate_id, referral_code").order("created_at").range(a, b)),
    loadOwners(notes),
    loadStripe(notes),
    all<EventRow>("Bezoekmeting", notes, (a, b) => db.from("marketing_events").select("event_name, session_id, tenant_id, path, referrer, utm_source, utm_medium, utm_campaign, gclid, fbclid, metadata, created_at").or(`created_at.gte."${since120}",event_name.eq.signup_completed`).order("created_at").range(a, b), 100_000),
    all<AffiliateRow>("Affiliates", notes, (a, b) => db.from("affiliates").select("id, username, name, email, channel, status, is_business, created_at").range(a, b)),
    all<RewardRow>("Beloningen", notes, (a, b) => db.from("referral_rewards").select("id, kind, affiliate_id, referrer_tenant_id, referred_tenant_id, amount_cents, base_cents, rate, status, invoice_paid_at, available_at").range(a, b)),
    all<ShopRow>("Shopify-installaties", notes, (a, b) => db.from("shopify_installations").select("tenant_id, shop_domain, status, installed_at, uninstalled_at").range(a, b)),
    all<{ tenant_id: string }>("Mailboxen", notes, (a, b) => db.from("tenant_email_channels").select("tenant_id").or("forwarding_status.eq.confirmed,imap_status.in.(active,connected)").range(a, b)),
    all<{ tenant_id: string }>("Google-koppelingen", notes, (a, b) => db.from("tenant_google_connections").select("tenant_id").eq("status", "active").range(a, b)),
    all<{ tenant_id: string }>("Microsoft-koppelingen", notes, (a, b) => db.from("tenant_microsoft_connections").select("tenant_id").eq("status", "active").range(a, b)),
    all<{ tenant_id: string }>("Antwoordconcepten", notes, (a, b) => db.from("support_decisions").select("tenant_id").gte("created_at", since30).range(a, b)),
  ]);

  const drafts30: Record<string, number> = {};
  for (const row of decisions) drafts30[row.tenant_id] = (drafts30[row.tenant_id] ?? 0) + 1;

  return {
    now: new Date(now).toISOString(),
    tenants, owners,
    subscriptions: stripe.subscriptions, invoices: stripe.invoices, refunds: stripe.refunds, stripeAvailable: stripe.available,
    events: events.map((row): RawMarketingEvent => ({
      event: row.event_name, sessionId: row.session_id, tenantId: row.tenant_id, path: row.path, referrer: row.referrer,
      utmSource: row.utm_source, utmMedium: row.utm_medium, utmCampaign: row.utm_campaign, gclid: row.gclid, fbclid: row.fbclid,
      label: typeof row.metadata?.label === "string" ? row.metadata.label : null, createdAt: row.created_at,
    })),
    affiliates: affiliates.map((row) => ({ id: row.id, username: row.username, name: row.name, email: row.email, channel: row.channel, status: row.status, isBusiness: row.is_business, createdAt: row.created_at })),
    rewards: rewards.map((row) => ({ id: row.id, kind: row.kind, affiliateId: row.affiliate_id, referrerTenantId: row.referrer_tenant_id, referredTenantId: row.referred_tenant_id, amountCents: row.amount_cents, baseCents: row.base_cents, rate: row.rate === null ? null : Number(row.rate), status: row.status, invoicePaidAt: row.invoice_paid_at, availableAt: row.available_at })),
    shopify: shopify.map((row) => ({ tenantId: row.tenant_id, shop: row.shop_domain, status: row.status, installedAt: row.installed_at, uninstalledAt: row.uninstalled_at })),
    connected: [...new Set([...emailChannels, ...google, ...microsoft].map((row) => row.tenant_id))],
    drafts30,
    planPriceCents: { ...Object.fromEntries(PAID_PLAN_CATALOG.map((plan) => [plan.id, plan.price * 100])), custom: PAID_PLAN_CATALOG.at(-1)!.price * 100 },
    affiliateMinPayoutCents: AFFILIATE.minPayoutCents,
    notes,
  };
}

/** Twee minuten bewaard: Stripe en de database hoeven niet bij elke klik opnieuw bevraagd. */
const cachedRaw = unstable_cache(loadRaw, ["backoffice-raw-v1"], { revalidate: 120 });

export async function loadDashboard(options: { fresh?: boolean } = {}) {
  if (backofficeDemo()) return buildDashboard(demoData());
  return buildDashboard(options.fresh ? await loadRaw() : await cachedRaw());
}
