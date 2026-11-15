/**
 * Regels van het doorverwijs- en affiliateprogramma, zonder database of Stripe,
 * zodat ze los te testen zijn. Bedragen in centen, exclusief btw.
 *
 * Twee programma's:
 * - Doorverwijzen (klanten): je deelt je eigen link; per nieuwe betalende klant krijg
 *   jij een percentage van je eigen maandbedrag als tegoed (wie meer betaalt, krijgt meer),
 *   en de nieuwe klant korting op de eerste maand. Maximaal 5 beloningen.
 * - Affiliate (iedereen, met of zonder account): je verdient 10% van wat jouw klanten
 *   betalen, zolang ze klant blijven. Hun klanten krijgen 10% korting op de eerste maand.
 *   Uitbetaald zodra de wachttijd voorbij is, zonder minimumbedrag.
 *
 * Een link (sequenceflow.io/r/<code>) en een code zijn hetzelfde: de gebruikersnaam
 * van de affiliate of de k-code van een klant. De code kan ook bij het aanmelden of
 * tijdens de proef worden ingevuld.
 */

export const REF_COOKIE = "sf_ref";
export const REF_COOKIE_DAYS = 60;

export const REFERRAL = {
  maxRewards: 5,
  referrerRate: 0.2, // 20% van het eigen maandbedrag als tegoed, per nieuwe betalende klant
  newCustomerRate: 0.1, // 10% korting op de eerste maand van de nieuwe klant
  holdDays: 30, // tegoed pas na 30 dagen, zodat een terugbetaling het niet oplevert
} as const;

/** Tegoed bij een maandbedrag (centen); 0 als er geen betaald abonnement is. */
export function referralCreditCents(monthlyCents: number | null | undefined, rate: number) {
  return monthlyCents ? Math.round(monthlyCents * rate) : 0;
}

export const AFFILIATE = {
  rate: 0.1, // van elke betaling, zolang de klant blijft
  newCustomerRate: 0.1, // korting op de eerste maand voor wie via een affiliate komt
  holdDays: 60, // pas uitbetaalbaar na terugboek- en chargebackperiode
} as const;

/**
 * Commissie voor de n-de betalende klant van een affiliate. Sinds november 2026 voor
 * iedere klant hetzelfde; het klantnummer blijft bewaard voor als er ooit weer treden komen.
 */
export function affiliateRate(customerNumber: number) {
  void customerNumber;
  return AFFILIATE.rate;
}

export function commissionCents(baseCents: number, rate: number) {
  return Math.round(baseCents * rate);
}

export function addDays(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/** Geschatte maandelijkse commissie bij deze maandbedragen (in volgorde van binnenkomst). */
export function estimatedMonthlyCommission(monthlyCents: number[]) {
  return monthlyCents.reduce((sum, cents, i) => sum + commissionCents(cents, affiliateRate(i + 1)), 0);
}

/** Gebruikersnaam voor de affiliatelink en het leaderboard: sequenceflow.io/r/<naam>. */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/;
const RESERVED = new Set(["admin", "sequenceflow", "support", "affiliate", "affiliates", "partner", "api", "login", "pricing"]);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function usernameProblem(value: string): string | null {
  const name = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(name)) return "Gebruik 3 tot 24 tekens: kleine letters, cijfers en streepjes.";
  if (RESERVED.has(name) || name.startsWith("k-")) return "Deze gebruikersnaam is niet beschikbaar.";
  return null;
}

/** Doorverwijscodes van klanten beginnen met k-, zodat ze nooit botsen met een affiliatenaam. */
export function newReferralCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `k-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

export function formatEuro(cents: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

/** Welkomstkorting voor wie via een klant of een affiliate kwam: percentage van de eerste maand. */
export function welcomeDiscountRate(tenant: { referred_by_tenant_id?: string | null; affiliate_id?: string | null }) {
  if (tenant.affiliate_id) return AFFILIATE.newCustomerRate;
  if (tenant.referred_by_tenant_id) return REFERRAL.newCustomerRate;
  return 0;
}


/** Kan deze werkruimte nog een code krijgen? Alleen zolang er nooit is betaald en er nog geen partner aan hangt. */
export function canClaimCode(tenant: { referred_by_tenant_id: string | null; affiliate_id: string | null; referral_credit_applied_at: string | null; stripe_subscription_id: string | null; plan: string }) {
  return !tenant.referred_by_tenant_id && !tenant.affiliate_id && !tenant.referral_credit_applied_at && !tenant.stripe_subscription_id && (tenant.plan === "trial" || tenant.plan === "expired");
}


/**
 * Wat er gebeurde met de aanmeldingen van een affiliate, zonder namen: nog in de proef,
 * betalend, afgehaakt na de proef, of later opgezegd.
 */
export function affiliateFunnel(tenants: Array<{ id: string; plan: string; trial_ends_at: string | null }>, everPaid: Set<string>, now = Date.now()) {
  const paid = new Set(["starter", "pro", "agency", "custom"]);
  let inTrial = 0, paying = 0, dropped = 0, canceled = 0;
  for (const tenant of tenants) {
    if (paid.has(tenant.plan)) paying++;
    else if (tenant.plan === "trial" && tenant.trial_ends_at && Date.parse(tenant.trial_ends_at) > now) inTrial++;
    else if (everPaid.has(tenant.id)) canceled++;
    else dropped++;
  }
  const decided = paying + dropped + canceled;
  return { signups: tenants.length, inTrial, paying, dropped, canceled, conversionPct: decided ? Math.round(((paying + canceled) / decided) * 100) : null };
}

