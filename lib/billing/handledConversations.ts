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
  version: "2026-11-05",
  mode: "shadow",
  observationHours: 72,
  rateCents: { ai_assisted: 49, ai_autonomous: 99 },
  baseCents: { starter: 4900, pro: 14900, agency: 29900 },
} as const;

export type ReplyKind = keyof typeof HANDLED_PRICING.rateCents;
/** Wat het verstuurde antwoord doet: echt antwoorden, of eerst iets vragen. */
export type ReplyPurpose = "answer" | "question";

export type ConversationEvidence = {
  conversationId: string;
  spam: boolean;
  /** Verstuurde antwoorden van Support One. Antwoorden zonder vastgelegde soort (van voor de meting) tellen niet. */
  replies: { sentAt: string; kind: ReplyKind | null; purpose: ReplyPurpose }[];
  /** Binnengekomen mails van de klant in dit gesprek. */
  customerMessages: string[];
};

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
export function summarizePeriod(results: HandledResult[], period: { start: Date; end: Date }) {
  const inPeriod = (iso: string) => {
    const time = Date.parse(iso);
    return time >= period.start.getTime() && time < period.end.getTime();
  };
  const handled = results.filter((result) => result.status === "handled" && inPeriod(result.finalAt));
  const pending = results.filter((result) => result.status === "pending");
  const count = (kind: ReplyKind) => handled.filter((result) => "kind" in result && result.kind === kind).length;
  const assisted = count("ai_assisted");
  const autonomous = count("ai_autonomous");
  return {
    assisted,
    autonomous,
    pending: pending.length,
    usageCents: assisted * HANDLED_PRICING.rateCents.ai_assisted + autonomous * HANDLED_PRICING.rateCents.ai_autonomous,
  };
}

/** Wat een verstuurd antwoord is, uit het besluit van de AI bij het concept. */
export function replyPurpose(decision: string | null | undefined): ReplyPurpose {
  return decision === "ask_question" ? "question" : "answer";
}
