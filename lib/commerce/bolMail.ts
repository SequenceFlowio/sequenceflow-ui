const BOL_DOMAINS = ["bol.com", "mail.bol.com", "partner.bol.com"];
const ORDER_REFERENCE = /\b(?=[A-Z0-9]{10}\b)(?=[A-Z0-9]*\d)[A-Z0-9]+\b/gi;

export function extractBolOrderReferences(subject: string, body: string) {
  return [...new Set(`${subject}\n${body}`.toUpperCase().match(ORDER_REFERENCE) ?? [])];
}
export function isRecognizedBolMail(input: {
  from: string;
  replyTo?: string | null;
  subject: string;
  headers?: Record<string, string> | null;
}) {
  const addresses = `${input.from} ${input.replyTo ?? ""}`.toLowerCase();
  const domainMatch = BOL_DOMAINS.some((domain) => addresses.includes(`@${domain}`) || addresses.includes(`.${domain}`));
  const headerText = Object.entries(input.headers ?? {}).map(([key, value]) => `${key}:${value}`).join("\n").toLowerCase();
  const markerMatch = /\bbol\.com\b|\bbol partner\b|\bklantvraag\b/.test(`${input.subject}\n${headerText}`.toLowerCase());
  return domainMatch && markerMatch;
}

export function bolReplyAddress(from: string, replyTo?: string | null) {
  return String(replyTo || from).trim().toLowerCase();
}
