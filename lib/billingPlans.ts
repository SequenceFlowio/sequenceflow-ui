export type Plan = "trial" | "starter" | "pro" | "agency" | "custom" | "expired";

export type PlanLimits = {
  /** Antwoordconcepten voor echte klantvragen per periode. */
  aiAnswers: number;
  inboxes: number;
  members: number;
  docs: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial:   { aiAnswers: 150,      inboxes: 1,        members: 1,        docs: 10       },
  // Getoond als Starter, Growth en Scale; de ids blijven gelijk voor Stripe en bestaande accounts.
  starter: { aiAnswers: 150,      inboxes: 1,        members: 2,        docs: 25       },
  pro:     { aiAnswers: 500,      inboxes: 1,        members: 5,        docs: 100      },
  agency:  { aiAnswers: 1500,     inboxes: 1,        members: Infinity, docs: Infinity },
  custom:  { aiAnswers: Infinity, inboxes: Infinity, members: Infinity, docs: Infinity },
  expired: { aiAnswers: 0,        inboxes: 0,        members: 0,        docs: 0        },
};

/**
 * Speling boven het pakket: tot 10% extra wordt er nog gewoon geschreven,
 * zodat niemand halverwege een drukke dag stilvalt. Daarna stopt het.
 */
export const USAGE_GRACE_RATIO = 0.1;

export function usageHardLimit(limit: number) {
  // Afronden vóór ceil: 100 * 1.1 is in floating point net iets boven 110.
  return Number.isFinite(limit) ? Math.ceil(Math.round(limit * (1 + USAGE_GRACE_RATIO) * 1e6) / 1e6) : limit;
}

export const ANALYTICS_PLANS: Plan[] = ["pro", "agency", "custom", "trial"];
export const AUTO_SEND_PLANS: Plan[] = ["pro", "agency", "custom"];
export const PAIN_POINT_PLANS: Plan[] = ["pro", "agency", "custom"];
/** Voorraad en inkoopadvies: alleen Scale (id agency) en maatwerk. Lagere pakketten zien een voorbeeld met een upgradeknop. */
export const INVENTORY_PLANS: Plan[] = ["agency", "custom"];

export type UsageDecision = {
  source_message_id: string | null;
  conversation_id: string | null;
  decision: string | null;
  model: string | null;
  has_draft: boolean;
};

/**
 * Eén antwoordconcept = één klantbericht waarvoor Support One een echt concept
 * schreef. Opnieuw genereren voor hetzelfde bericht telt niet opnieuw; een
 * vervolgvraag in hetzelfde gesprek wel. Niet mee tellen: mail die als 'geen
 * klantvraag' is beoordeeld, een noodantwoord zonder AI en gesprekken die
 * zijn uitgesloten (genegeerd of teruggeboekte spam).
 */
export function countAnswerUnits(decisions: UsageDecision[], excludedConversationIds: ReadonlySet<string>) {
  const units = new Set<string>();
  for (const item of decisions) {
    if (!item.source_message_id || !item.has_draft) continue;
    if (item.decision === "ignore" || item.model === "system-fallback") continue;
    if (item.conversation_id && excludedConversationIds.has(item.conversation_id)) continue;
    units.add(item.source_message_id);
  }
  return units.size;
}

/**
 * The start of the current monthly usage period. Stripe moves the stored start
 * on every invoice; a workspace without Stripe (a partner on a fixed plan, or
 * a missed webhook) would otherwise count usage since its very first month and
 * eventually be blocked for good. So the stored start rolls forward by whole
 * months to the latest anniversary that is not in the future.
 */
export function currentUsagePeriodStart(stored: string | null | undefined, now: Date = new Date()) {
  const fallback = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  if (!stored) return fallback;
  const start = new Date(stored);
  if (Number.isNaN(start.getTime()) || start > now) return Number.isNaN(start.getTime()) ? fallback : start.toISOString();
  let months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
  const candidate = (count: number) => {
    const date = new Date(start);
    const day = start.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(start.getUTCMonth() + count);
    // The 31st in a shorter month becomes that month's last day.
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
    return date;
  };
  while (months > 0 && candidate(months) > now) months -= 1;
  return candidate(Math.max(0, months)).toISOString();
}
