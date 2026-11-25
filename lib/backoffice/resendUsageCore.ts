/**
 * Verbruik en limieten van Resend (GET /usage). Telt verzonden én ontvangen mails:
 * de doorgestuurde klantmails die via Resend binnenkomen, tellen dus ook mee.
 * Zonder database of imports met een alias, zodat het los te testen is.
 */

export const RESEND_USAGE_URL = "https://resend.com/settings/usage";
export const RESEND_PRICING_URL = "https://resend.com/pricing";
/** Vanaf dit deel van een limiet waarschuwen; daarboven is het tijd om te upgraden. */
export const WARN_SHARE = 0.8;

export type QuotaWindow = { used: number; limit: number | null; sent: number; received: number; resetsAt: string | null };

export type ResendUsage = {
  daily: QuotaWindow;
  monthly: QuotaWindow;
  domains: { used: number; limit: number | null } | null;
  rateLimit: { limit: number; duration: string } | null;
};

export type UsageVerdict = {
  /** "ok": ruim binnen; "watch": loopt op; "upgrade": tijd om te upgraden; "blocked": limiet bereikt, mails worden geweigerd. */
  level: "ok" | "watch" | "upgrade" | "blocked";
  dailyShare: number | null;
  monthlyShare: number | null;
  /** Verwacht verbruik aan het eind van de maand bij het tempo tot nu toe. */
  projectedMonth: number;
  projectedShare: number | null;
  reasons: string[];
};

function windowFrom(value: unknown): QuotaWindow {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const number = (field: unknown) => (typeof field === "number" && Number.isFinite(field) ? field : 0);
  return {
    used: number(raw.used),
    limit: typeof raw.limit === "number" && Number.isFinite(raw.limit) ? raw.limit : null,
    sent: number(raw.sent),
    received: number(raw.received),
    resetsAt: typeof raw.resets_at === "string" ? raw.resets_at : null,
  };
}

/** Het antwoord van GET https://api.resend.com/usage, teruggebracht tot wat het dashboard toont. */
export function parseResendUsage(body: unknown): ResendUsage | null {
  const raw = (body && typeof body === "object" ? body : null) as Record<string, unknown> | null;
  const emails = raw?.emails as Record<string, unknown> | undefined;
  if (!emails || typeof emails !== "object") return null;
  const domains = raw?.domains as { used?: unknown; limit?: unknown } | undefined;
  const rate = raw?.rate_limit as { limit?: unknown; duration?: unknown } | undefined;
  return {
    daily: windowFrom(emails.daily),
    monthly: windowFrom(emails.monthly),
    domains: domains && typeof domains.used === "number" ? { used: domains.used, limit: typeof domains.limit === "number" ? domains.limit : null } : null,
    rateLimit: rate && typeof rate.limit === "number" ? { limit: rate.limit, duration: String(rate.duration ?? "") } : null,
  };
}

const share = (window: QuotaWindow) => (window.limit && window.limit > 0 ? window.used / window.limit : null);

/** Hoe staan we ervoor, en moeten we upgraden? `now` voor de tests. */
export function judgeUsage(usage: ResendUsage, now = new Date()): UsageVerdict {
  const dailyShare = share(usage.daily);
  const monthlyShare = share(usage.monthly);
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  // Tempo tot nu toe, doorgetrokken naar het eind van de maand. Op dag 1 en 2 zegt dat te weinig.
  const projectedMonth = day >= 3 ? Math.round((usage.monthly.used / day) * daysInMonth) : usage.monthly.used;
  const projectedShare = usage.monthly.limit && usage.monthly.limit > 0 ? projectedMonth / usage.monthly.limit : null;
  const reasons: string[] = [];
  let level: UsageVerdict["level"] = "ok";
  const raise = (next: UsageVerdict["level"]) => {
    const order = ["ok", "watch", "upgrade", "blocked"] as const;
    if (order.indexOf(next) > order.indexOf(level)) level = next;
  };
  if ((dailyShare ?? 0) >= 1 || (monthlyShare ?? 0) >= 1) {
    raise("blocked");
    reasons.push((monthlyShare ?? 0) >= 1 ? "De maandlimiet is bereikt: Resend weigert nu mails." : "De daglimiet is bereikt: Resend weigert mails tot de teller terugloopt.");
  }
  if (monthlyShare !== null && monthlyShare >= WARN_SHARE && monthlyShare < 1) { raise("upgrade"); reasons.push(`${Math.round(monthlyShare * 100)}% van de maandlimiet is op.`); }
  if (dailyShare !== null && dailyShare >= WARN_SHARE && dailyShare < 1) { raise("upgrade"); reasons.push(`${Math.round(dailyShare * 100)}% van de daglimiet is op.`); }
  if (projectedShare !== null && projectedShare >= 1 && (monthlyShare ?? 0) < 1) { raise("upgrade"); reasons.push(`Bij dit tempo kom je deze maand op zo'n ${projectedMonth.toLocaleString("nl-NL")} mails, boven de limiet.`); }
  else if (projectedShare !== null && projectedShare >= WARN_SHARE && projectedShare < 1) { raise("watch"); reasons.push(`Bij dit tempo kom je deze maand op zo'n ${Math.round(projectedShare * 100)}% van de limiet.`); }
  if (dailyShare !== null && dailyShare >= 0.5 && dailyShare < WARN_SHARE) { raise("watch"); reasons.push(`Vandaag is ${Math.round(dailyShare * 100)}% van de daglimiet gebruikt.`); }
  return { level, dailyShare, monthlyShare, projectedMonth, projectedShare, reasons };
}
