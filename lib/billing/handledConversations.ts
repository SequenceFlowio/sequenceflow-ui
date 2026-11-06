/**
 * Afgehandelde gesprekken tellen: de basis van het gebruiksdeel van de
 * factuur (vast bedrag per maand + €0,49 per gecontroleerde en €0,99 per
 * zelfstandige afhandeling). Puur, zonder database, zodat de teller, de app
 * en de tests dezelfde regels gebruiken.
 *
 * De regels, in klanttaal:
 * - Een gesprek is één klantvraag, ook als er meerdere mails over gaan.
 * - Een concept kost niets. Pas een verstuurd, inhoudelijk antwoord telt.
 *   Een wedervraag ("welk ordernummer?") telt niet.
 * - Daarna volgt 72 uur controle. Komt de klant in die tijd terug, dan vervalt
 *   de telling. Ook een bedankje laat hem vervallen: twijfel is in het
 *   voordeel van de klant.
 * - Lost daarna iemand het toch op, dan telt het hooguit als gecontroleerd
 *   (€0,49), ook als de AI het later zelf verstuurt.
 * - Per gesprek nooit meer dan één afhandeling. Spam telt nooit.
 *
 * Status: alleen meten. Er wordt niets mee gefactureerd.
 */

export const HANDLED_PRICING = {
  version: "2026-11-06",
  mode: "shadow",
  observationHours: 72,
  rateCents: { ai_assisted: 49, ai_autonomous: 99 },
  baseCents: { starter: 4900, pro: 14900, agency: 29900 },
  /** Afgehandelde gesprekken per periode die bij het vaste bedrag horen; pas daarboven telt het tarief. */
  includedPerPeriod: { trial: 0, starter: 100, pro: 300, agency: 1000, custom: 0, expired: 0 },
} as const;

/** Hoeveel afgehandelde gesprekken er bij een pakket inbegrepen zijn. */
export function includedHandled(plan: string | null | undefined) {
  return (HANDLED_PRICING.includedPerPeriod as Record<string, number>)[plan ?? ""] ?? 0;
}

export type ReplyKind = keyof typeof HANDLED_PRICING.rateCents;
/** Wat het verstuurde antwoord doet: echt antwoorden, of eerst iets vragen. */
export type ReplyPurpose = "answer" | "question";

export type ConversationEvidence = {
  conversationId: string;
  spam: boolean;
  /** Verstuurde antwoorden van Support One. Antwoorden zonder vastgelegde soort (van voor de meting) tellen niet. */
  replies: { sentAt: string; kind: ReplyKind | null; purpose: ReplyPurpose }[];
  /** Binnengekomen mails van de klant in dit gesprek (een kaal bedankje staat hier niet in, zie isThanksOnly). */
  customerMessages: string[];
};

const THANKS = /\b(dank|bedankt|dankjewel|dankuwel|thanks|thank you|thx|merci|top|super|perfect|fijn|geweldig|great|prima|helemaal goed|okay|oke|oké|ok)\b/i;
const NOT_DONE = /\b(niet|geen|nog steeds|nog altijd|nog niet|maar|wanneer|waar|hoe|waarom|kapot|beschadigd|retour|terug|probleem|klacht|still|not|no|but|when|where|how|why|broken|damaged|return|refund|problem)\b/i;

/**
 * Een bericht dat alleen bedankt ("Top, dank je!") is geen terugkomen: het
 * gesprek is juist opgelost. Kort, geen vraag, wel een bedankje, en niets dat
 * op een nieuw probleem wijst. Bij twijfel telt het als terugkomen, zodat de
 * klant nooit betaalt voor een gesprek dat niet klaar was.
 */
export function isThanksOnly(text: string | null | undefined) {
  const kept: string[] = [];
  for (const line of (text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (/^(-{2,}|on .+ wrote:|op .+ schreef|(from|van):\s)/i.test(trimmed)) break;
    if (!trimmed.startsWith(">")) kept.push(trimmed);
  }
  const body = kept.join(" ").replace(/\s+/g, " ").trim();
  if (!body || body.length > 160 || body.includes("?")) return false;
  return THANKS.test(body) && !NOT_DONE.test(body);
}

export type HandledResult =
  | { status: "handled"; kind: ReplyKind; rateCents: number; sentAt: string; finalAt: string }
  | { status: "pending"; kind: ReplyKind; rateCents: number; sentAt: string; finalAt: string }
  | { status: "not_billable"; reason: "spam" | "no_answer_sent" | "customer_returned" };

const HOUR = 60 * 60 * 1000;

/** Wat een gesprek op dit moment oplevert: definitief afgehandeld, nog in controle, of niets. */
export function assessConversation(evidence: ConversationEvidence, now: Date): HandledResult {
  if (evidence.spam) return { status: "not_billable", reason: "spam" };
  const inbound = evidence.customerMessages.map(Date.parse).filter(Number.isFinite).sort((a, b) => a - b);
  const answers = evidence.replies
    .filter((reply) => reply.purpose === "answer" && reply.kind)
    .map((reply) => ({ ...reply, time: Date.parse(reply.sentAt) }))
    .filter((reply) => Number.isFinite(reply.time))
    .sort((a, b) => a.time - b.time);

  let returned = false;
  for (const answer of answers) {
    const end = answer.time + HANDLED_PRICING.observationHours * HOUR;
    // Terug binnen de controletijd, of al vóór "nu" als de tijd nog loopt.
    if (inbound.some((time) => time > answer.time && time <= Math.min(end, now.getTime()))) {
      returned = true;
      continue;
    }
    const kind: ReplyKind = returned ? "ai_assisted" : (answer.kind as ReplyKind);
    const result = { kind, rateCents: HANDLED_PRICING.rateCents[kind], sentAt: new Date(answer.time).toISOString(), finalAt: new Date(end).toISOString() };
    return now.getTime() >= end ? { status: "handled", ...result } : { status: "pending", ...result };
  }
  return { status: "not_billable", reason: returned ? "customer_returned" : "no_answer_sent" };
}

/** De optelsom voor één periode: alleen gesprekken die in die periode definitief werden. */
export function summarizePeriod(results: HandledResult[], period: { start: Date; end: Date }, included = 0) {
  const inPeriod = (iso: string) => {
    const time = Date.parse(iso);
    return time >= period.start.getTime() && time < period.end.getTime();
  };
  const handled = results
    .filter((result): result is Extract<HandledResult, { status: "handled" }> => result.status === "handled" && inPeriod(result.finalAt))
    .sort((a, b) => Date.parse(a.finalAt) - Date.parse(b.finalAt));
  const pending = results.filter((result) => result.status === "pending");
  const count = (kind: ReplyKind) => handled.filter((result) => result.kind === kind).length;
  // De eerste gesprekken van de periode horen bij het pakket; daarna telt het tarief.
  const includedUsed = Math.min(Math.max(0, included), handled.length);
  const usageCents = handled.slice(includedUsed).reduce((sum, result) => sum + HANDLED_PRICING.rateCents[result.kind], 0);
  return {
    assisted: count("ai_assisted"),
    autonomous: count("ai_autonomous"),
    pending: pending.length,
    included,
    includedUsed,
    usageCents,
  };
}

/** Wat een verstuurd antwoord is, uit het besluit van de AI bij het concept. */
export function replyPurpose(decision: string | null | undefined): ReplyPurpose {
  return decision === "ask_question" ? "question" : "answer";
}

export type LedgerStatus = "included" | "pending_report" | "over_budget" | "not_billed";

/**
 * Wat er met nieuwe definitieve afhandelingen gebeurt, op volgorde van
 * afronden. Eerst de inbegrepen gesprekken van het pakket. Zonder betaald
 * abonnement: alleen vastleggen. Boven het maandbudget: gratis, de klant
 * krijgt nooit meer gefactureerd dan hij zelf heeft ingesteld.
 */
export function ledgerStatuses(
  rates: number[],
  input: { billable: boolean; alreadyThisPeriodCents: number; budgetCents: number | null; includedLeft?: number },
): LedgerStatus[] {
  let total = input.alreadyThisPeriodCents;
  let includedLeft = Math.max(0, input.includedLeft ?? 0);
  return rates.map((rate) => {
    if (!input.billable) return "not_billed";
    if (includedLeft > 0) {
      includedLeft -= 1;
      return "included";
    }
    if (input.budgetCents !== null && total + rate > input.budgetCents) return "over_budget";
    total += rate;
    return "pending_report";
  });
}

/** Waarschuwing bij 80% en 100% van het budget. */
export function budgetLevel(usedCents: number, budgetCents: number | null): "none" | "near" | "reached" {
  if (budgetCents === null || budgetCents <= 0) return budgetCents === 0 ? "reached" : "none";
  if (usedCents >= budgetCents) return "reached";
  return usedCents >= budgetCents * 0.8 ? "near" : "none";
}

/** De namen van de Stripe-meters per soort afhandeling. */
export const METER_EVENT: Record<ReplyKind, string> = { ai_assisted: "handled_assisted", ai_autonomous: "handled_autonomous" };
