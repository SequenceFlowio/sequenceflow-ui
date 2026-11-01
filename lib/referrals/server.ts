import { createHash, randomBytes } from "node:crypto";
import type Stripe from "stripe";

import { PAID_PLAN_CATALOG } from "@/lib/planCatalog";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  AFFILIATE,
  REFERRAL,
  REF_COOKIE_DAYS,
  addDays,
  affiliateRate,
  commissionCents,
  estimatedMonthlyCommission,
  newReferralCode,
  normalizeUsername,
} from "./program";

/**
 * Database- en Stripe-kant van doorverwijzen en affiliates (migratie 059).
 * Commissie en tegoed worden alleen berekend over Stripe-facturen; workspaces die via
 * Shopify App Pricing betalen tellen (nog) niet mee.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;
const db = (): Db => getSupabaseAdmin();

/* ---------- Cookie en toeschrijving ---------- */

/** Cookie op .sequenceflow.io, zodat een klik op de website ook bij aanmelden in de app meetelt. */
export function refCookieOptions(host: string | null) {
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * REF_COOKIE_DAYS,
    path: "/",
    ...(hostname.endsWith("sequenceflow.io") ? { domain: ".sequenceflow.io" } : {}),
  };
}

/** Bestaat deze code als affiliatenaam of als doorverwijscode van een klant? */
export async function resolveRefCode(code: string) {
  const value = normalizeUsername(code);
  if (value.startsWith("k-")) {
    const { data } = await db().from("tenants").select("id").eq("referral_code", value).maybeSingle();
    return data ? { type: "referral" as const, tenantId: data.id as string } : null;
  }
  const { data } = await db().from("affiliates").select("id, email, user_id, status").eq("username", value).maybeSingle();
  return data && data.status === "active" ? { type: "affiliate" as const, affiliateId: data.id as string, email: data.email as string, userId: data.user_id as string | null } : null;
}

/** Koppelt een nieuwe workspace aan wie hem heeft binnengebracht. Zelf doorverwijzen telt niet. */
export async function attributeNewTenant(tenantId: string, user: { id: string; email?: string | null }, code: string | undefined) {
  if (!code) return;
  const ref = await resolveRefCode(code);
  if (!ref) return;
  if (ref.type === "referral") {
    if (ref.tenantId === tenantId) return;
    const { data: member } = await db().from("tenant_members").select("tenant_id").eq("user_id", user.id).eq("tenant_id", ref.tenantId).maybeSingle();
    if (member) return;
    await db().from("tenants").update({ referred_by_tenant_id: ref.tenantId }).eq("id", tenantId).is("referred_by_tenant_id", null).is("affiliate_id", null);
  } else {
    if (ref.userId === user.id || (user.email && ref.email.toLowerCase() === user.email.toLowerCase())) return;
    await db().from("tenants").update({ affiliate_id: ref.affiliateId }).eq("id", tenantId).is("referred_by_tenant_id", null).is("affiliate_id", null);
  }
}

/* ---------- Doorverwijzen door klanten ---------- */

export async function ensureReferralCode(tenantId: string) {
  const { data } = await db().from("tenants").select("referral_code").eq("id", tenantId).single();
  if (data?.referral_code) return data.referral_code as string;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newReferralCode();
    const { error } = await db().from("tenants").update({ referral_code: code }).eq("id", tenantId).is("referral_code", null);
    if (!error) {
      const { data: again } = await db().from("tenants").select("referral_code").eq("id", tenantId).single();
      return again?.referral_code as string;
    }
  }
  throw new Error("Doorverwijscode aanmaken mislukt");
}

export async function referralOverview(tenantId: string) {
  const code = await ensureReferralCode(tenantId);
  const [{ data: referred }, { data: rewards }] = await Promise.all([
    db().from("tenants").select("id, plan, created_at").eq("referred_by_tenant_id", tenantId),
    db().from("referral_rewards").select("amount_cents, status").eq("kind", "referrer_credit").eq("referrer_tenant_id", tenantId),
  ]);
  const valid = (rewards ?? []).filter((r) => r.status !== "reversed");
  return {
    code,
    signedUp: referred?.length ?? 0,
    paying: valid.length,
    maxRewards: REFERRAL.maxRewards,
    earnedCents: valid.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount_cents, 0),
    pendingCents: valid.filter((r) => r.status !== "paid").reduce((sum, r) => sum + r.amount_cents, 0),
    referrerCreditCents: REFERRAL.referrerCreditCents,
    newCustomerCreditCents: REFERRAL.newCustomerCreditCents,
  };
}

/** €25 tegoed voor een doorverwezen klant, vóór de eerste checkout op hun Stripe-klant gezet. */
export async function applyNewCustomerCredit(stripe: Stripe, tenantId: string, customerId: string) {
  const { data: tenant } = await db().from("tenants").select("referred_by_tenant_id, referral_credit_applied_at").eq("id", tenantId).single();
  if (!tenant?.referred_by_tenant_id || tenant.referral_credit_applied_at) return;
  const { data: claimed } = await db().from("tenants").update({ referral_credit_applied_at: new Date().toISOString() }).eq("id", tenantId).is("referral_credit_applied_at", null).select("id");
  if (!claimed?.length) return;
  await stripe.customers.createBalanceTransaction(customerId, {
    amount: -REFERRAL.newCustomerCreditCents,
    currency: "eur",
    description: "Welkomsttegoed via doorverwijzing",
  });
}

/* ---------- Stripe-facturen ---------- */

async function paymentRef(stripe: Stripe, invoiceId: string) {
  try {
    const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 3 });
    const payment = payments.data.find((p) => p.status === "paid")?.payment ?? payments.data[0]?.payment;
    const ref = payment?.payment_intent ?? payment?.charge;
    return typeof ref === "string" ? ref : ref?.id ?? null;
  } catch {
    return null;
  }
}

/** Factuurbedrag excl. btw dat echt betaald is (tegoed telt niet mee). */
function paidBaseCents(invoice: Stripe.Invoice) {
  if (!invoice.amount_paid || invoice.amount_paid <= 0) return 0;
  const total = invoice.total ?? invoice.amount_paid;
  const excl = invoice.total_excluding_tax ?? total;
  return total > 0 ? Math.round(excl * Math.min(1, invoice.amount_paid / total)) : 0;
}

/** Boekt commissie (affiliate) of tegoed (doorverwijzer) voor een betaalde factuur. Idempotent per factuur. */
export async function recordInvoiceRewards(stripe: Stripe, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const base = paidBaseCents(invoice);
  if (!customerId || !invoice.id || base <= 0) return;
  const { data: tenant } = await db().from("tenants").select("id, affiliate_id, referred_by_tenant_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (!tenant || (!tenant.affiliate_id && !tenant.referred_by_tenant_id)) return;

  const paidAt = new Date((invoice.status_transitions?.paid_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const ref = await paymentRef(stripe, invoice.id);

  if (tenant.affiliate_id) {
    const { data: earlier } = await db().from("referral_rewards").select("referred_tenant_id, customer_number").eq("kind", "affiliate_commission").eq("affiliate_id", tenant.affiliate_id).neq("status", "reversed");
    const mine = earlier?.find((r) => r.referred_tenant_id === tenant.id);
    const customerNumber = mine?.customer_number ?? new Set((earlier ?? []).map((r) => r.referred_tenant_id)).size + 1;
    const rate = affiliateRate(customerNumber);
    await db().from("referral_rewards").upsert({
      kind: "affiliate_commission", affiliate_id: tenant.affiliate_id, referred_tenant_id: tenant.id, customer_number: customerNumber,
      stripe_invoice_id: invoice.id, stripe_payment_ref: ref, base_cents: base, rate, amount_cents: commissionCents(base, rate),
      currency: invoice.currency ?? "eur", invoice_paid_at: paidAt, available_at: addDays(paidAt, AFFILIATE.holdDays),
    }, { onConflict: "kind,stripe_invoice_id", ignoreDuplicates: true });
  }

  if (tenant.referred_by_tenant_id) {
    // Alleen bij de eerste betaalde factuur, en hooguit 5 keer per doorverwijzer
    const { data: existing } = await db().from("referral_rewards").select("referred_tenant_id, status").eq("kind", "referrer_credit").eq("referrer_tenant_id", tenant.referred_by_tenant_id);
    const valid = (existing ?? []).filter((r) => r.status !== "reversed");
    if (valid.some((r) => r.referred_tenant_id === tenant.id) || valid.length >= REFERRAL.maxRewards) return;
    await db().from("referral_rewards").upsert({
      kind: "referrer_credit", referrer_tenant_id: tenant.referred_by_tenant_id, referred_tenant_id: tenant.id,
      stripe_invoice_id: invoice.id, stripe_payment_ref: ref, base_cents: base, amount_cents: REFERRAL.referrerCreditCents,
      currency: "eur", invoice_paid_at: paidAt, available_at: addDays(paidAt, REFERRAL.holdDays),
    }, { onConflict: "kind,stripe_invoice_id", ignoreDuplicates: true });
  }
}

/** Terugbetaling of chargeback: commissie en tegoed op die betaling vervallen (als ze nog niet zijn uitbetaald). */
export async function reverseRewardsForPayment(refs: Array<string | null | undefined>) {
  const ids = refs.filter((r): r is string => Boolean(r));
  if (!ids.length) return;
  await db().from("referral_rewards").update({ status: "reversed", settled_at: new Date().toISOString() }).in("stripe_payment_ref", ids).in("status", ["pending", "available"]);
}

/** Dagelijks: wachttijd voorbij → uitbetaalbaar; tegoed voor doorverwijzers meteen op hun Stripe-saldo. */
export async function settleDueRewards(stripe: Stripe | null) {
  const now = new Date().toISOString();
  await db().from("referral_rewards").update({ status: "available" }).eq("status", "pending").lte("available_at", now);
  if (!stripe) return { credited: 0 };

  const { data: credits } = await db().from("referral_rewards").select("id, referrer_tenant_id, amount_cents").eq("kind", "referrer_credit").eq("status", "available").limit(100);
  let credited = 0;
  for (const credit of credits ?? []) {
    const { data: referrer } = await db().from("tenants").select("stripe_customer_id").eq("id", credit.referrer_tenant_id).maybeSingle();
    if (!referrer?.stripe_customer_id) continue; // nog geen Stripe-klant (proef of Shopify): blijft staan tot dat wel zo is
    // eerst claimen, dan pas Stripe: zo wordt tegoed nooit dubbel gegeven
    const { data: claimed } = await db().from("referral_rewards").update({ status: "paid", settled_at: now }).eq("id", credit.id).eq("status", "available").select("id");
    if (!claimed?.length) continue;
    try {
      const txn = await stripe.customers.createBalanceTransaction(referrer.stripe_customer_id, {
        amount: -credit.amount_cents,
        currency: "eur",
        description: "Tegoed voor een doorverwezen klant",
      });
      await db().from("referral_rewards").update({ settlement_ref: txn.id }).eq("id", credit.id);
      credited++;
    } catch (error) {
      console.error("[referrals] tegoed op Stripe zetten mislukt", error);
      await db().from("referral_rewards").update({ status: "available", settled_at: null }).eq("id", credit.id);
    }
  }
  return { credited };
}

/* ---------- Affiliates ---------- */

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAffiliate(input: {
  username: string; name: string; email: string; isBusiness: boolean; companyName?: string; kvkNumber?: string; vatNumber?: string; channel?: string; showOnLeaderboard: boolean;
}) {
  const token = randomBytes(24).toString("base64url");
  const { data, error } = await db().from("affiliates").insert({
    username: normalizeUsername(input.username), name: input.name, email: input.email, is_business: input.isBusiness,
    company_name: input.companyName || null, kvk_number: input.kvkNumber || null, vat_number: input.vatNumber || null,
    channel: input.channel || null, show_on_leaderboard: input.showOnLeaderboard, access_token_hash: hashToken(token),
  }).select("id, username").single();
  if (error) {
    if (error.code === "23505") return { error: "Deze gebruikersnaam is al bezet." as const };
    throw new Error(error.message);
  }
  return { affiliate: data as { id: string; username: string }, token };
}

const PLAN_PRICE_CENTS = Object.fromEntries(PAID_PLAN_CATALOG.map((p) => [p.id, p.price * 100])) as Record<string, number>;

async function affiliateCustomers(affiliateIds: string[]) {
  if (!affiliateIds.length) return new Map<string, number[]>();
  const { data } = await db().from("tenants").select("affiliate_id, plan, created_at").in("affiliate_id", affiliateIds).order("created_at");
  const map = new Map<string, number[]>();
  for (const t of data ?? []) {
    const price = PLAN_PRICE_CENTS[t.plan as string];
    if (!price) continue; // alleen betalende klanten
    map.set(t.affiliate_id as string, [...(map.get(t.affiliate_id as string) ?? []), price]);
  }
  return map;
}

export async function affiliateDashboard(token: string) {
  if (!token || token.length < 20) return null;
  const { data: affiliate } = await db().from("affiliates").select("id, username, name, status, created_at").eq("access_token_hash", hashToken(token)).maybeSingle();
  if (!affiliate) return null;
  const [{ data: rewards }, { count: signups }, customers] = await Promise.all([
    db().from("referral_rewards").select("amount_cents, status").eq("kind", "affiliate_commission").eq("affiliate_id", affiliate.id),
    db().from("tenants").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliate.id),
    affiliateCustomers([affiliate.id]),
  ]);
  const sum = (status: string) => (rewards ?? []).filter((r) => r.status === status).reduce((s, r) => s + r.amount_cents, 0);
  const paying = customers.get(affiliate.id) ?? [];
  return {
    username: affiliate.username as string,
    name: affiliate.name as string,
    status: affiliate.status as string,
    signups: signups ?? 0,
    payingCustomers: paying.length,
    estimatedMonthlyCents: estimatedMonthlyCommission(paying),
    pendingCents: sum("pending"),
    availableCents: sum("available"),
    paidCents: sum("paid"),
  };
}

/* ---------- Leaderboard ---------- */

export interface LeaderboardRow {
  username: string;
  customers: number;
  estimatedMonthlyCents: number;
}

/**
 * Voorbeeldcijfers tot er echte affiliates zijn. Zet AFFILIATE_LEADERBOARD_LIVE=true
 * om de echte stand te tonen.
 */
const DEMO: Array<[string, number]> = [
  ["webshopwouter", 34], ["ecomlisa", 27], ["shopstudio-nl", 21], ["groeimetjoost", 16], ["dtc-daan", 12],
  ["bolbaas", 9], ["storecraft", 7], ["marketingmila", 5], ["webshopwijs", 4], ["nickverkoopt", 2],
];
const DEMO_AVG_PLAN_CENTS = 18_000;

export function leaderboardIsDemo() {
  return process.env.AFFILIATE_LEADERBOARD_LIVE !== "true";
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardRow[]> {
  if (leaderboardIsDemo()) {
    return DEMO.slice(0, limit).map(([username, customers]) => ({ username, customers, estimatedMonthlyCents: estimatedMonthlyCommission(Array(customers).fill(DEMO_AVG_PLAN_CENTS)) }));
  }
  const { data: affiliates } = await db().from("affiliates").select("id, username").eq("status", "active").eq("show_on_leaderboard", true);
  const customers = await affiliateCustomers((affiliates ?? []).map((a) => a.id as string));
  return (affiliates ?? [])
    .map((a) => {
      const paying = customers.get(a.id as string) ?? [];
      return { username: a.username as string, customers: paying.length, estimatedMonthlyCents: estimatedMonthlyCommission(paying) };
    })
    .filter((row) => row.customers > 0)
    .sort((a, b) => b.estimatedMonthlyCents - a.estimatedMonthlyCents)
    .slice(0, limit);
}
