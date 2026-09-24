/**
 * Leesbare namen voor de ruwe waarden die de pipeline opslaat (intent,
 * beslissing, status). Zonder deze tabel kwamen ze als omgezette Engelse
 * sleutels in beeld ("Order Status", "Pending Autosend"), ook in de
 * Nederlandse interface.
 */

type Language = "nl" | "en";
type LabelMap = Record<string, { nl: string; en: string }>;

const INTENTS: LabelMap = {
  order_status:     { nl: "Bestelstatus",       en: "Order status" },
  return_request:   { nl: "Retour",             en: "Return" },
  damaged:          { nl: "Beschadigd product", en: "Damaged product" },
  damaged_item:     { nl: "Beschadigd product", en: "Damaged product" },
  missing_items:    { nl: "Ontbrekend artikel", en: "Missing item" },
  complaint:        { nl: "Klacht",             en: "Complaint" },
  warranty:         { nl: "Garantie",           en: "Warranty" },
  cancellation:     { nl: "Annulering",         en: "Cancellation" },
  payment:          { nl: "Betaling",           en: "Payment" },
  invoice:          { nl: "Factuur",            en: "Invoice" },
  shipping:         { nl: "Verzending",         en: "Shipping" },
  product_question: { nl: "Productvraag",       en: "Product question" },
  compliment:       { nl: "Compliment",         en: "Compliment" },
  fallback:         { nl: "Overig",             en: "Other" },
  other:            { nl: "Overig",             en: "Other" },
  unknown:          { nl: "Overig",             en: "Other" },
};

const DECISIONS: LabelMap = {
  draft:        { nl: "Antwoordconcept",       en: "Reply draft" },
  reply:        { nl: "Antwoord",              en: "Reply" },
  human_review: { nl: "Ter beoordeling",       en: "Needs review" },
  escalate:     { nl: "Doorsturen",            en: "Forward" },
  ignore:       { nl: "Geen antwoord nodig",   en: "No reply needed" },
  ask_question: { nl: "Vraagt om informatie",  en: "Asks for details" },
};

const STATUSES: LabelMap = {
  review:           { nl: "Ter beoordeling",               en: "Needs review" },
  pending_review:   { nl: "Ter beoordeling",               en: "Needs review" },
  draft:            { nl: "Antwoordconcept",               en: "Reply draft" },
  open:             { nl: "Open",                          en: "Open" },
  approved:         { nl: "Goedgekeurd",                   en: "Approved" },
  pending_autosend: { nl: "Wordt automatisch verstuurd",   en: "Scheduled to send" },
  sent:             { nl: "Verzonden",                     en: "Sent" },
  escalated:        { nl: "Doorgestuurd",                  en: "Forwarded" },
  archived:         { nl: "Gearchiveerd",                  en: "Archived" },
  spam:             { nl: "Spam",                          en: "Spam" },
  failed:           { nl: "Mislukt",                       en: "Failed" },
  blocked:          { nl: "Geblokkeerd",                   en: "Blocked" },
};

const TABLES = { intent: INTENTS, decision: DECISIONS, status: STATUSES };

/** Laatste redmiddel voor een onbekende waarde: dan liever leesbaar dan leeg. */
function humanize(value: string) {
  const text = value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function supportLabel(
  kind: keyof typeof TABLES,
  value: string | null | undefined,
  language: Language = "nl",
): string {
  if (!value) return "";
  const key = value.trim().toLowerCase();
  // De classifier schrijft soms varianten als "order_status_inquiry"; die
  // horen bij hetzelfde onderwerp als "order_status".
  const base = key.replace(/_(inquiry|question|request)$/, "");
  return TABLES[kind][key]?.[language] ?? TABLES[kind][base]?.[language] ?? humanize(key);
}
