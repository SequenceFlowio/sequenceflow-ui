/**
 * Rekenwerk voor het beheerdashboard: van ruwe rijen (werkruimtes, Stripe,
 * eigen bezoekmeting, affiliates) naar de cijfers op het scherm. Geen database
 * of netwerk en geen imports met een alias, zodat alles los te testen is.
 * Bedragen in centen, exclusief btw. Tijden als ISO-tekst.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_PLANS = new Set(["starter", "pro", "agency", "custom"]);
const LIVE_SUBSCRIPTION = new Set(["active", "past_due", "trialing", "unpaid"]);
const OWN_HOSTS = ["sequenceflow.io", "localhost", "vercel.app"];

/* ---------- Ruwe invoer ---------- */

export type RawTenant = {
  id: string; name: string | null; plan: string; created_at: string; trial_ends_at: string | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
  referred_by_tenant_id: string | null; affiliate_id: string | null; referral_code: string | null;
};
export type RawSubscription = {
  id: string; customerId: string; status: string; startedAt: string; canceledAt: string | null;
  /** Opzegging die al vaststaat maar nog niet is ingegaan. */
  cancelAt: string | null; monthlyCents: number; reason: string | null;
};
export type RawInvoice = { id: string; customerId: string | null; status: string; netCents: number; createdAt: string; paidAt: string | null; reason: string | null; attempts: number };
export type RawRefund = { amountCents: number; createdAt: string };
export type RawMarketingEvent = {
  event: string; sessionId: string; tenantId: string | null; path: string; referrer: string | null;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; gclid: string | null; fbclid: string | null;
  label: string | null; createdAt: string;
};
export type RawAffiliate = { id: string; username: string; name: string; email: string; channel: string | null; status: string; isBusiness: boolean; createdAt: string };
export type RawReward = {
  id: string; kind: string; affiliateId: string | null; referrerTenantId: string | null; referredTenantId: string;
  amountCents: number; baseCents: number; rate: number | null; status: string; invoicePaidAt: string; availableAt: string;
};
export type RawShopify = { tenantId: string | null; shop: string; status: string; installedAt: string | null; uninstalledAt: string | null };
export type RawOwner = { email: string | null; lastSignInAt: string | null };

export type RawData = {
  now: string;
  tenants: RawTenant[];
  owners: Record<string, RawOwner>;
  subscriptions: RawSubscription[];
  invoices: RawInvoice[];
  refunds: RawRefund[];
  events: RawMarketingEvent[];
  affiliates: RawAffiliate[];
  rewards: RawReward[];
  shopify: RawShopify[];
  /** Werkruimtes met een gekoppelde mailbox. */
  connected: string[];
  /** Antwoordconcepten per werkruimte in de laatste 30 dagen. */
  drafts30: Record<string, number>;
  planPriceCents: Record<string, number>;
  affiliateMinPayoutCents: number;
  /** Stripe was niet te bereiken of niet ingesteld: omzetcijfers ontbreken dan. */
  stripeAvailable: boolean;
  notes: string[];
};

/* ---------- Klanten ---------- */

export type CustomerStatus = "trial" | "paying" | "free" | "trial_expired" | "canceled";

export type Customer = {
  id: string; name: string; email: string | null; app: string; plan: string; status: CustomerStatus;
  channel: "stripe" | "shopify" | null;
  signedUpAt: string; trialEndsAt: string | null; paidSince: string | null; daysToPay: number | null;
  canceledAt: string | null; cancelScheduledFor: string | null; cancelReason: string | null;
  mrrCents: number; mrrEstimated: boolean; paidTotalCents: number;
  source: string; sourceKind: "affiliate" | "referral" | "marketing" | "unknown";
  connected: boolean; drafts30: number; lastSignInAt: string | null;
};

export type TimelineEvent = { at: string; kind: "signup" | "paid" | "cancel_scheduled" | "canceled" | "trial_expired" | "shopify_uninstalled"; customer: string; detail: string };

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const minIso = (values: Array<string | null | undefined>) => values.filter((value): value is string => Boolean(value)).sort()[0] ?? null;
const maxIso = (values: Array<string | null | undefined>) => values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

export function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function hostOf(referrer: string | null) {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Waar een bezoek vandaan kwam, in één woord: utm_source, anders advertentieklik, anders de verwijzende site. */
export function sourceOf(event: Pick<RawMarketingEvent, "utmSource" | "gclid" | "fbclid" | "referrer">) {
  if (event.utmSource) return event.utmSource.trim().toLowerCase();
  if (event.gclid) return "google ads";
  if (event.fbclid) return "meta ads";
  const host = hostOf(event.referrer);
  if (!host || OWN_HOSTS.some((own) => host === own || host.endsWith(`.${own}`))) return "direct";
  if (/(^|\.)google\./.test(host)) return "google (organisch)";
  if (/(^|\.)bing\.com$/.test(host)) return "bing";
  if (/(facebook|instagram)\.com$/.test(host) || host === "l.facebook.com") return "meta (organisch)";
  if (/linkedin\.com$|lnkd\.in$/.test(host)) return "linkedin";
  if (/chatgpt\.com$|openai\.com$|perplexity\.ai$|claude\.ai$/.test(host)) return "ai-assistent";
  return host;
}

export function buildCustomers(raw: RawData) {
  const now = Date.parse(raw.now);
  const subsByCustomer = groupBy(raw.subscriptions, (sub) => sub.customerId);
  const invoicesByCustomer = groupBy(raw.invoices.filter((invoice) => invoice.customerId), (invoice) => invoice.customerId!);
  const shopifyByTenant = new Map(raw.shopify.filter((row) => row.tenantId).map((row) => [row.tenantId!, row]));
  const affiliateById = new Map(raw.affiliates.map((affiliate) => [affiliate.id, affiliate]));
  const tenantById = new Map(raw.tenants.map((tenant) => [tenant.id, tenant]));
  const signupByTenant = new Map<string, RawMarketingEvent>();
  for (const event of raw.events) if (event.event === "signup_completed" && event.tenantId && !signupByTenant.has(event.tenantId)) signupByTenant.set(event.tenantId, event);
  const connected = new Set(raw.connected);
  const timeline: TimelineEvent[] = [];

  const customers = raw.tenants.map((tenant): Customer => {
    const name = tenant.name?.trim() || tenant.id.slice(0, 8);
    const subs = tenant.stripe_customer_id ? subsByCustomer.get(tenant.stripe_customer_id) ?? [] : [];
    const invoices = tenant.stripe_customer_id ? invoicesByCustomer.get(tenant.stripe_customer_id) ?? [] : [];
    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid" && invoice.netCents > 0);
    const live = subs.filter((sub) => LIVE_SUBSCRIPTION.has(sub.status));
    const shop = shopifyByTenant.get(tenant.id);
    const shopActive = shop?.status === "active";
    const paidPlan = PAID_PLANS.has(tenant.plan);
    const everPaid = subs.length > 0 || paidInvoices.length > 0;

    let status: CustomerStatus;
    let channel: Customer["channel"] = null;
    if (paidPlan) {
      // Zonder Stripe-gegevens telt het abonnements-id in onze eigen database.
      if (live.length || (!raw.stripeAvailable && tenant.stripe_subscription_id)) { status = "paying"; channel = "stripe"; }
      else if (shopActive) { status = "paying"; channel = "shopify"; }
      else status = "free";
    } else if (tenant.plan === "trial" && ms(tenant.trial_ends_at) > now) {
      status = "trial";
      channel = shopActive ? "shopify" : null;
    } else {
      status = everPaid ? "canceled" : "trial_expired";
    }

    // Shopify meldt geen startdatum van de betaling: de proef daar duurt ook 14 dagen.
    const shopifyPaidFrom = status === "paying" && channel === "shopify" ? new Date(ms(shop?.installedAt ?? tenant.created_at) + 14 * DAY_MS).toISOString() : null;
    const paidSince = status === "free" ? null : minIso([...subs.map((sub) => sub.startedAt), ...paidInvoices.map((invoice) => invoice.paidAt), shopifyPaidFrom]);
    const canceledAt = status === "canceled" ? maxIso(subs.map((sub) => sub.canceledAt)) : null;
    const scheduled = status === "paying" ? minIso(live.map((sub) => sub.cancelAt)) : null;
    const stripeMrr = live.reduce((sum, sub) => sum + sub.monthlyCents, 0);
    const mrrEstimated = status === "paying" && (channel === "shopify" || stripeMrr === 0);
    const mrrCents = status !== "paying" ? 0 : mrrEstimated ? raw.planPriceCents[tenant.plan] ?? 0 : stripeMrr;

    let source = "Onbekend";
    let sourceKind: Customer["sourceKind"] = "unknown";
    const signup = signupByTenant.get(tenant.id);
    if (tenant.affiliate_id) {
      source = `Affiliate: ${affiliateById.get(tenant.affiliate_id)?.username ?? "onbekend"}`;
      sourceKind = "affiliate";
    } else if (tenant.referred_by_tenant_id) {
      source = `Doorverwezen door ${tenantById.get(tenant.referred_by_tenant_id)?.name?.trim() || "klant"}`;
      sourceKind = "referral";
    } else if (signup) {
      source = sourceOf(signup) + (signup.utmCampaign ? ` · ${signup.utmCampaign}` : "");
      sourceKind = "marketing";
    }

    const daysToPay = paidSince ? Math.max(0, Math.round((ms(paidSince) - ms(tenant.created_at)) / DAY_MS)) : null;
    const owner = raw.owners[tenant.id];

    timeline.push({ at: tenant.created_at, kind: "signup", customer: name, detail: `Proef van 14 dagen gestart${sourceKind === "unknown" ? "" : ` (${source})`}` });
    if (paidSince) timeline.push({ at: paidSince, kind: "paid", customer: name, detail: `Betaald abonnement gestart${daysToPay === null ? "" : `, ${daysToPay} ${daysToPay === 1 ? "dag" : "dagen"} na aanmelding`}` });
    if (scheduled) timeline.push({ at: scheduled, kind: "cancel_scheduled", customer: name, detail: "Heeft opgezegd; abonnement loopt af op deze datum" });
    if (canceledAt) timeline.push({ at: canceledAt, kind: "canceled", customer: name, detail: `Abonnement beëindigd${reasonText(subs)}` });
    if (status === "trial_expired" && tenant.trial_ends_at && ms(tenant.trial_ends_at) <= now) timeline.push({ at: tenant.trial_ends_at, kind: "trial_expired", customer: name, detail: "Proef afgelopen zonder betaling" });
    if (shop?.uninstalledAt) timeline.push({ at: shop.uninstalledAt, kind: "shopify_uninstalled", customer: name, detail: `Shopify-app verwijderd (${shop.shop})` });

    return {
      id: tenant.id, name, email: owner?.email ?? null, app: "Support One", plan: tenant.plan, status, channel,
      signedUpAt: tenant.created_at, trialEndsAt: tenant.trial_ends_at, paidSince, daysToPay,
      canceledAt, cancelScheduledFor: scheduled, cancelReason: canceledAt || scheduled ? reasonText(subs).replace(/^: /, "") || null : null,
      mrrCents, mrrEstimated, paidTotalCents: paidInvoices.reduce((sum, invoice) => sum + invoice.netCents, 0),
      source, sourceKind, connected: connected.has(tenant.id), drafts30: raw.drafts30[tenant.id] ?? 0, lastSignInAt: owner?.lastSignInAt ?? null,
    };
  });

  timeline.sort((a, b) => b.at.localeCompare(a.at));
  return { customers, timeline };
}

function reasonText(subs: RawSubscription[]) {
  const reason = subs.map((sub) => sub.reason).find(Boolean);
  return reason ? `: ${reason}` : "";
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}

/* ---------- Kerncijfers en reeksen ---------- */

export type MonthPoint = { month: string; signups: number; paid: number; canceled: number; revenueCents: number; refundCents: number };
export type Cohort = { week: string; signups: number; paying: number; trial: number; lost: number; ratePct: number | null };

const monthKey = (iso: string) => iso.slice(0, 7);

export function lastMonths(nowIso: string, count: number) {
  const now = new Date(nowIso);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
}

/** Maandag van de week waarin deze dag valt (UTC). */
export function weekStart(iso: string) {
  const date = new Date(iso);
  const day = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day)).toISOString().slice(0, 10);
}

export function buildOverview(raw: RawData, customers: Customer[]) {
  const now = Date.parse(raw.now);
  const within = (iso: string | null, days: number, offsetDays = 0) => {
    const time = ms(iso);
    return Number.isFinite(time) && time > now - (days + offsetDays) * DAY_MS && time <= now - offsetDays * DAY_MS;
  };

  const paying = customers.filter((customer) => customer.status === "paying");
  const trials = customers.filter((customer) => customer.status === "trial");
  const mrrCents = paying.reduce((sum, customer) => sum + customer.mrrCents, 0);
  const signups30 = customers.filter((customer) => within(customer.signedUpAt, 30)).length;
  const signupsPrev30 = customers.filter((customer) => within(customer.signedUpAt, 30, 30)).length;
  const newPaid30 = customers.filter((customer) => within(customer.paidSince, 30)).length;
  const canceled30 = customers.filter((customer) => within(customer.canceledAt, 30)).length;
  // Wie 30 dagen geleden betaalde: de betalers van nu, plus wie sindsdien wegging, min wie sindsdien begon.
  const payingAtStart = paying.length + canceled30 - newPaid30;
  const churnPct = pct(canceled30, Math.max(payingAtStart, 0));

  // Omzetting: alleen aanmeldingen waarvan de proef al is afgelopen, anders valt het cijfer te laag uit.
  const mature = customers.filter((customer) => customer.status !== "free" && ms(customer.signedUpAt) <= now - 14 * DAY_MS);
  const matureConverted = mature.filter((customer) => customer.paidSince);
  const mature90 = mature.filter((customer) => ms(customer.signedUpAt) > now - 104 * DAY_MS);

  const months = lastMonths(raw.now, 12);
  const byMonth = new Map(months.map((month) => [month, { month, signups: 0, paid: 0, canceled: 0, revenueCents: 0, refundCents: 0 } as MonthPoint]));
  for (const customer of customers) {
    if (byMonth.has(monthKey(customer.signedUpAt))) byMonth.get(monthKey(customer.signedUpAt))!.signups++;
    if (customer.paidSince && byMonth.has(monthKey(customer.paidSince))) byMonth.get(monthKey(customer.paidSince))!.paid++;
    if (customer.canceledAt && byMonth.has(monthKey(customer.canceledAt))) byMonth.get(monthKey(customer.canceledAt))!.canceled++;
  }
  for (const invoice of raw.invoices) {
    if (invoice.status === "paid" && invoice.paidAt && byMonth.has(monthKey(invoice.paidAt))) byMonth.get(monthKey(invoice.paidAt))!.revenueCents += invoice.netCents;
  }
  for (const refund of raw.refunds) if (byMonth.has(monthKey(refund.createdAt))) byMonth.get(monthKey(refund.createdAt))!.refundCents += refund.amountCents;
  const series = months.map((month) => byMonth.get(month)!);

  const weeks = Array.from({ length: 10 }, (_, index) => weekStart(new Date(now - (9 - index) * 7 * DAY_MS).toISOString()));
  const cohorts: Cohort[] = weeks.map((week) => {
    const members = customers.filter((customer) => customer.status !== "free" && weekStart(customer.signedUpAt) === week);
    const converted = members.filter((customer) => customer.paidSince).length;
    const trial = members.filter((customer) => customer.status === "trial").length;
    return { week, signups: members.length, paying: converted, trial, lost: members.length - converted - trial, ratePct: pct(converted, members.length - trial) };
  });

  const arpaCents = paying.length ? Math.round(mrrCents / paying.length) : 0;
  const planMix = [...groupBy(paying, (customer) => customer.plan).entries()]
    .map(([plan, members]) => ({ plan, count: members.length, mrrCents: members.reduce((sum, customer) => sum + customer.mrrCents, 0) }))
    .sort((a, b) => b.mrrCents - a.mrrCents);

  const thisMonth = series.at(-1)!;
  const lastMonth = series.at(-2)!;
  const openInvoices = raw.invoices.filter((invoice) => invoice.status === "open" && invoice.attempts > 0);

  return {
    mrrCents, arrCents: mrrCents * 12, arpaCents,
    paying: paying.length, trials: trials.length, free: customers.filter((customer) => customer.status === "free").length,
    total: customers.length,
    signups7: customers.filter((customer) => within(customer.signedUpAt, 7)).length, signups30, signupsPrev30,
    newPaid30, canceled30, churnPct,
    /** Wat een klant gemiddeld oplevert over de hele looptijd, bij de huidige uitval. Null zonder uitval. */
    ltvCents: churnPct && churnPct > 0 ? Math.round(arpaCents / (churnPct / 100)) : null,
    conversionPct: pct(matureConverted.length, mature.length), conversionBase: mature.length,
    conversion90Pct: pct(mature90.filter((customer) => customer.paidSince).length, mature90.length), conversion90Base: mature90.length,
    medianDaysToPay: median(customers.filter((customer) => customer.daysToPay !== null).map((customer) => customer.daysToPay!)),
    trialsEndingSoon: trials.filter((customer) => ms(customer.trialEndsAt) <= now + 3 * DAY_MS).sort((a, b) => (a.trialEndsAt ?? "").localeCompare(b.trialEndsAt ?? "")),
    cancelScheduled: paying.filter((customer) => customer.cancelScheduledFor),
    revenueThisMonthCents: thisMonth.revenueCents, revenueLastMonthCents: lastMonth.revenueCents,
    revenue12Cents: series.reduce((sum, point) => sum + point.revenueCents, 0),
    refunds12Cents: series.reduce((sum, point) => sum + point.refundCents, 0),
    openInvoices: openInvoices.length, openInvoicesCents: openInvoices.reduce((sum, invoice) => sum + invoice.netCents, 0),
    estimatedMrrCents: paying.filter((customer) => customer.mrrEstimated).reduce((sum, customer) => sum + customer.mrrCents, 0),
    series, cohorts, planMix,
    funnel: [
      { label: "Aangemeld", value: customers.length },
      { label: "Mailbox gekoppeld", value: customers.filter((customer) => customer.connected).length },
      { label: "Concepten in 30 dagen", value: customers.filter((customer) => customer.drafts30 > 0).length },
      { label: "Betalend", value: paying.length },
    ],
  };
}

/* ---------- Bezoek en herkomst (eigen meting) ---------- */

export type SourceRow = { key: string; sessions: number; cta: number; signups: number; paying: number; mrrCents: number };

const isRefClick = (event: RawMarketingEvent) => event.path.startsWith("/r/");

export function buildMarketing(raw: RawData, customers: Customer[], days = 30) {
  const now = Date.parse(raw.now);
  const since = now - days * DAY_MS;
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  type Session = { source: string; campaign: string; landing: string; at: string; cta: boolean; tenantId: string | null };
  const sessions = new Map<string, Session>();
  const ordered = [...raw.events].filter((event) => ms(event.createdAt) > since && !isRefClick(event)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ctaLabels = new Map<string, number>();

  for (const event of ordered) {
    let session = sessions.get(event.sessionId);
    if (!session && event.event !== "cta_click") {
      // Een aanmelding draagt de herkomst van het eerste bezoek mee, ook als dat bezoek buiten de periode viel.
      session = { source: sourceOf(event), campaign: event.utmCampaign?.trim() || "(geen campagne)", landing: event.event === "landing_view" ? event.path : "(eerder bezoek)", at: event.createdAt, cta: false, tenantId: null };
      sessions.set(event.sessionId, session);
    }
    if (event.event === "cta_click") {
      if (session) session.cta = true;
      const label = event.label?.trim() || "(zonder naam)";
      ctaLabels.set(label, (ctaLabels.get(label) ?? 0) + 1);
    }
    if (event.event === "signup_completed" && session) session.tenantId = event.tenantId ?? "onbekend";
  }

  const rows = (key: (session: Session) => string) => {
    const out = new Map<string, SourceRow>();
    for (const session of sessions.values()) {
      const row = out.get(key(session)) ?? { key: key(session), sessions: 0, cta: 0, signups: 0, paying: 0, mrrCents: 0 };
      row.sessions++;
      if (session.cta) row.cta++;
      if (session.tenantId) {
        row.signups++;
        const customer = customerById.get(session.tenantId);
        if (customer?.status === "paying") { row.paying++; row.mrrCents += customer.mrrCents; }
      }
      out.set(row.key, row);
    }
    return [...out.values()].sort((a, b) => b.sessions - a.sessions);
  };

  const dayKeys = Array.from({ length: days }, (_, index) => new Date(now - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10));
  const daily = new Map(dayKeys.map((day) => [day, { day, sessions: 0, signups: 0 }]));
  for (const session of sessions.values()) {
    const point = daily.get(session.at.slice(0, 10));
    if (point && session.landing !== "(eerder bezoek)") point.sessions++;
  }
  for (const event of ordered) if (event.event === "signup_completed") { const point = daily.get(event.createdAt.slice(0, 10)); if (point) point.signups++; }

  const all = [...sessions.values()];
  const visits = all.filter((session) => session.landing !== "(eerder bezoek)");
  return {
    days,
    sessions: visits.length,
    ctaSessions: all.filter((session) => session.cta).length,
    signups: all.filter((session) => session.tenantId).length,
    paying: all.filter((session) => session.tenantId && customerById.get(session.tenantId)?.status === "paying").length,
    googleAdClicks: ordered.filter((event) => event.event === "landing_view" && event.gclid).length,
    metaAdClicks: ordered.filter((event) => event.event === "landing_view" && event.fbclid).length,
    bySource: rows((session) => session.source),
    byCampaign: rows((session) => session.campaign).filter((row) => row.key !== "(geen campagne)"),
    byLanding: rows((session) => session.landing).filter((row) => row.key !== "(eerder bezoek)"),
    ctaLabels: [...ctaLabels.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    daily: dayKeys.map((day) => daily.get(day)!),
  };
}

/* ---------- Doorverwijzingen en affiliates ---------- */

export type AffiliateRow = {
  id: string; username: string; name: string; email: string; channel: string | null; status: string; createdAt: string;
  clicks: number; signups: number; paying: number; mrrCents: number;
  pendingCents: number; availableCents: number; paidCents: number; reversedCents: number;
};
export type ReferrerRow = { tenantId: string; name: string; code: string | null; clicks: number; signups: number; paying: number; pendingCents: number; paidCents: number };

export function buildReferrals(raw: RawData, customers: Customer[]) {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const clicks = new Map<string, number>();
  for (const event of raw.events) {
    if (!isRefClick(event)) continue;
    const code = event.path.slice(3).toLowerCase();
    clicks.set(code, (clicks.get(code) ?? 0) + 1);
  }
  const sumRewards = (rows: RawReward[], status: string) => rows.filter((reward) => reward.status === status).reduce((sum, reward) => sum + reward.amountCents, 0);

  const affiliates: AffiliateRow[] = raw.affiliates.map((affiliate) => {
    const theirs = raw.tenants.filter((tenant) => tenant.affiliate_id === affiliate.id).map((tenant) => customerById.get(tenant.id)!).filter(Boolean);
    const paying = theirs.filter((customer) => customer.status === "paying");
    const rewards = raw.rewards.filter((reward) => reward.kind === "affiliate_commission" && reward.affiliateId === affiliate.id);
    return {
      id: affiliate.id, username: affiliate.username, name: affiliate.name, email: affiliate.email, channel: affiliate.channel, status: affiliate.status, createdAt: affiliate.createdAt,
      clicks: clicks.get(affiliate.username.toLowerCase()) ?? 0, signups: theirs.length, paying: paying.length, mrrCents: paying.reduce((sum, customer) => sum + customer.mrrCents, 0),
      pendingCents: sumRewards(rewards, "pending"), availableCents: sumRewards(rewards, "available"), paidCents: sumRewards(rewards, "paid"), reversedCents: sumRewards(rewards, "reversed"),
    };
  }).sort((a, b) => b.mrrCents - a.mrrCents || b.signups - a.signups || b.clicks - a.clicks);

  const referrers: ReferrerRow[] = raw.tenants.map((tenant) => {
    const theirs = raw.tenants.filter((other) => other.referred_by_tenant_id === tenant.id).map((other) => customerById.get(other.id)!).filter(Boolean);
    const rewards = raw.rewards.filter((reward) => reward.kind === "referrer_credit" && reward.referrerTenantId === tenant.id);
    return {
      tenantId: tenant.id, name: tenant.name?.trim() || tenant.id.slice(0, 8), code: tenant.referral_code,
      clicks: tenant.referral_code ? clicks.get(tenant.referral_code.toLowerCase()) ?? 0 : 0,
      signups: theirs.length, paying: theirs.filter((customer) => customer.status === "paying").length,
      pendingCents: sumRewards(rewards, "pending") + sumRewards(rewards, "available"), paidCents: sumRewards(rewards, "paid"),
    };
  }).filter((row) => row.clicks > 0 || row.signups > 0 || row.pendingCents > 0 || row.paidCents > 0).sort((a, b) => b.paying - a.paying || b.signups - a.signups || b.clicks - a.clicks);

  const viaAffiliate = customers.filter((customer) => customer.sourceKind === "affiliate");
  const viaReferral = customers.filter((customer) => customer.sourceKind === "referral");
  const other = customers.filter((customer) => customer.sourceKind !== "affiliate" && customer.sourceKind !== "referral" && customer.status !== "free");
  const rate = (group: Customer[]) => pct(group.filter((customer) => customer.paidSince).length, group.filter((customer) => customer.status !== "trial").length);
  const commissions = raw.rewards.filter((reward) => reward.kind === "affiliate_commission");
  const credits = raw.rewards.filter((reward) => reward.kind === "referrer_credit");
  const tenantName = (id: string | null) => (id ? customerById.get(id)?.name ?? "—" : "—");
  const affiliateName = new Map(raw.affiliates.map((affiliate) => [affiliate.id, affiliate.username]));

  return {
    affiliates, referrers,
    activeAffiliates: raw.affiliates.filter((affiliate) => affiliate.status === "active").length,
    newAffiliates30: raw.affiliates.filter((affiliate) => ms(affiliate.createdAt) > Date.parse(raw.now) - 30 * DAY_MS).length,
    clicksTotal: [...clicks.values()].reduce((sum, value) => sum + value, 0),
    viaAffiliate: viaAffiliate.length, viaReferral: viaReferral.length,
    sharePct: pct(viaAffiliate.length + viaReferral.length, customers.filter((customer) => customer.status !== "free").length),
    partnerMrrCents: [...viaAffiliate, ...viaReferral].reduce((sum, customer) => sum + customer.mrrCents, 0),
    conversion: { affiliate: rate(viaAffiliate), referral: rate(viaReferral), other: rate(other) },
    commissionPendingCents: sumRewards(commissions, "pending"), commissionAvailableCents: sumRewards(commissions, "available"), commissionPaidCents: sumRewards(commissions, "paid"),
    creditOpenCents: sumRewards(credits, "pending") + sumRewards(credits, "available"), creditPaidCents: sumRewards(credits, "paid"),
    payoutsDue: affiliates.filter((affiliate) => affiliate.availableCents >= raw.affiliateMinPayoutCents),
    silentAffiliates: affiliates.filter((affiliate) => affiliate.status === "active" && affiliate.clicks === 0 && affiliate.signups === 0).length,
    rewards: [...raw.rewards].sort((a, b) => b.invoicePaidAt.localeCompare(a.invoicePaidAt)).slice(0, 25).map((reward) => ({
      id: reward.id, at: reward.invoicePaidAt, kind: reward.kind, status: reward.status, amountCents: reward.amountCents, baseCents: reward.baseCents, rate: reward.rate, availableAt: reward.availableAt,
      who: reward.kind === "affiliate_commission" ? affiliateName.get(reward.affiliateId ?? "") ?? "—" : tenantName(reward.referrerTenantId),
      customer: tenantName(reward.referredTenantId),
    })),
  };
}

/* ---------- Wat valt op ---------- */

const nl = (value: number | null) => (value === null ? "—" : value.toLocaleString("nl-NL"));

export type Insight = { tone: "good" | "warn" | "info"; text: string };

export function buildInsights(raw: RawData, customers: Customer[], overview: ReturnType<typeof buildOverview>, marketing: ReturnType<typeof buildMarketing>, referrals: ReturnType<typeof buildReferrals>): Insight[] {
  const out: Insight[] = [];
  const trials = customers.filter((customer) => customer.status === "trial");
  const idle = trials.filter((customer) => !customer.connected);
  if (overview.trialsEndingSoon.length) out.push({ tone: "warn", text: `${overview.trialsEndingSoon.length} ${overview.trialsEndingSoon.length === 1 ? "proef loopt" : "proeven lopen"} binnen 3 dagen af: ${overview.trialsEndingSoon.slice(0, 4).map((customer) => customer.name).join(", ")}. Een persoonlijk bericht nu levert het meest op.` });
  if (idle.length) out.push({ tone: "warn", text: `${idle.length} van ${trials.length} lopende proeven ${idle.length === 1 ? "heeft" : "hebben"} nog geen mailbox gekoppeld. Zonder koppeling ziet een klant het product niet werken.` });
  if (overview.cancelScheduled.length) out.push({ tone: "warn", text: `${overview.cancelScheduled.length} betalende ${overview.cancelScheduled.length === 1 ? "klant heeft" : "klanten hebben"} opgezegd en ${overview.cancelScheduled.length === 1 ? "loopt" : "lopen"} nog af: ${overview.cancelScheduled.map((customer) => customer.name).join(", ")}.` });
  if (overview.openInvoices) out.push({ tone: "warn", text: `${overview.openInvoices} ${overview.openInvoices === 1 ? "factuur is" : "facturen zijn"} niet geïncasseerd; Stripe probeert het opnieuw.` });
  const quiet = customers.filter((customer) => customer.status === "paying" && customer.drafts30 === 0);
  if (quiet.length) out.push({ tone: "warn", text: `${quiet.length} betalende ${quiet.length === 1 ? "klant had" : "klanten hadden"} in 30 dagen geen enkel antwoordconcept (${quiet.slice(0, 4).map((customer) => customer.name).join(", ")}). Wie het product niet gebruikt, zegt eerder op.` });
  if (referrals.payoutsDue.length) out.push({ tone: "info", text: `${referrals.payoutsDue.length} ${referrals.payoutsDue.length === 1 ? "affiliate kan" : "affiliates kunnen"} worden uitbetaald.` });

  const sources = marketing.bySource.filter((row) => row.sessions >= 20);
  const best = [...sources].sort((a, b) => b.signups / b.sessions - a.signups / a.sessions)[0];
  if (best && best.signups > 0) out.push({ tone: "good", text: `Beste bron in ${marketing.days} dagen: ${best.key}, met ${best.signups} aanmeldingen uit ${best.sessions} bezoeken (${nl(pct(best.signups, best.sessions))}%).` });
  const leak = sources.filter((row) => row.signups === 0).sort((a, b) => b.sessions - a.sessions)[0];
  if (leak) out.push({ tone: "info", text: `${leak.key} bracht ${leak.sessions} bezoeken en geen enkele aanmelding. Kijk naar de pagina waar die bezoekers landen.` });
  if (marketing.sessions >= 50 && marketing.ctaSessions / marketing.sessions < 0.05) out.push({ tone: "info", text: `Maar ${nl(pct(marketing.ctaSessions, marketing.sessions))}% van de bezoekers klikt op een knop. De eerste schermhoogte van de landingspagina verdient een test.` });
  if (overview.conversion90Pct !== null && overview.conversion90Base >= 5) out.push({ tone: overview.conversion90Pct >= 15 ? "good" : "info", text: `Van de ${overview.conversion90Base} proeven die de laatste 90 dagen afliepen werd ${nl(overview.conversion90Pct)}% betalend.` });
  if (overview.estimatedMrrCents > 0) out.push({ tone: "info", text: "Een deel van de maandomzet is geschat: Shopify rekent zelf af (in dollars) en geeft ons geen factuurbedragen door." });
  return out;
}

export function buildDashboard(raw: RawData) {
  const { customers, timeline } = buildCustomers(raw);
  const overview = buildOverview(raw, customers);
  const marketing = buildMarketing(raw, customers, 30);
  const referrals = buildReferrals(raw, customers);
  return { now: raw.now, customers, timeline, overview, marketing, referrals, insights: buildInsights(raw, customers, overview, marketing, referrals), notes: raw.notes, stripeAvailable: raw.stripeAvailable };
}

export type Dashboard = ReturnType<typeof buildDashboard>;
