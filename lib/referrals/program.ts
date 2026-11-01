/**
 * Regels van het doorverwijs- en affiliateprogramma, zonder database of Stripe,
 * zodat ze los te testen zijn. Bedragen in centen, exclusief btw.
 *
 * Twee programma's:
 * - Doorverwijzen (klanten): je deelt je eigen link; per nieuwe betalende klant krijg
 *   jij tegoed op je abonnement en de nieuwe klant ook. Maximaal 5 beloningen.
 * - Affiliate (iedereen, met of zonder account): je verdient een percentage van wat
 *   jouw klanten betalen, zolang ze klant blijven. Klant 1 t/m 5: 5%, vanaf klant 6: 10%.
 */

export const REF_COOKIE = "sf_ref";
export const REF_COOKIE_DAYS = 60;

export const REFERRAL = {
  maxRewards: 5,
  referrerCreditCents: 5_000, // €50 tegoed voor wie doorverwijst
  newCustomerCreditCents: 2_500, // €25 tegoed voor de nieuwe klant, op de eerste factuur
  holdDays: 30, // tegoed pas na 30 dagen, zodat een terugbetaling het niet oplevert
} as const;

export const AFFILIATE = {
  tiers: [
    { fromCustomer: 1, rate: 0.05 },
    { fromCustomer: 6, rate: 0.1 },
  ],
  holdDays: 60, // pas uitbetaalbaar na terugboek- en chargebackperiode
  minPayoutCents: 5_000,
} as const;

/** Commissie voor de n-de betalende klant van een affiliate (1 = de eerste). */
export function affiliateRate(customerNumber: number) {
  let rate: number = AFFILIATE.tiers[0].rate;
  for (const tier of AFFILIATE.tiers) if (customerNumber >= tier.fromCustomer) rate = tier.rate;
  return rate;
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
