/**
 * Feitencheck (docs/plan-werkstroomkern.md, fase 2): elk bestelnummer, elke
 * trackingcode of -link, elk bedrag, elke datum en elke leverbelofte in een
 * concept moet terug te vinden zijn in de bestelgegevens, de kennisbank of de
 * mail van de klant. Puur, zonder aliasimports, zodat de pipeline, de testset en
 * de tests precies dezelfde regels gebruiken.
 */

export type FactCheckOrder = {
  displayName: string;
  totalAmount: number;
  orderCreatedAt?: string | null;
  items: Array<{ unitPrice?: number | null; latestDeliveryAt?: string | null }>;
  fulfillments: Array<{ trackingNumber?: string | null; trackingUrl?: string | null; shipmentDate?: string | null; latestTransportEventAt?: string | null }>;
};

export type FactIssue = { kind: "order" | "tracking" | "url" | "amount" | "date" | "promise"; value: string };

export type FactCheckInput = {
  draft: string;
  /** Onderwerp en tekst van de klantmail: wat de klant zelf noemt, mag terugkomen. */
  customerText: string;
  /** Kennisbank, agentprofiel en sjablonen zoals ze in de prompt stonden. */
  sourceText: string;
  order: FactCheckOrder | null;
  candidates?: FactCheckOrder[];
};

const MONTHS = "januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|january|february|march|may|june|july|august|october";
const DATE = new RegExp(`\\b\\d{1,2}[-/.]\\d{1,2}(?:[-/.]\\d{2,4})?\\b|\\b\\d{1,2}\\s+(?:${MONTHS})\\b`, "gi");
const AMOUNT = /€\s?\d{1,5}(?:[.,]\d{2})?|\b\d{1,5}[.,]\d{2}\s?(?:euro|eur)\b/gi;
const ORDER_REF = /#\d{3,}/g;
const CODE = /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10,}\b/g;
const URL = /https?:\/\/[^\s)>"']+/gi;
const PROMISE = /\bkomt\s+(?:morgen|overmorgen|vandaag)\s+aan\b|\b(?:morgen|overmorgen|vandaag|tomorrow|today)\b[^.!?\n]{0,40}\b(?:geleverd|bezorgd|aankomt|binnen|in huis|delivered|arrive|arrives)\b|\b(?:geleverd|bezorgd|delivered)\b[^.!?\n]{0,20}\b(?:morgen|overmorgen|vandaag|tomorrow|today)\b/gi;

function compact(value: string) {
  return value.toLowerCase().replace(/[\s#€]/g, "");
}

function moneyKey(value: string) {
  const digits = value.replace(/[^\d.,]/g, "");
  const normalized = digits.includes(",") ? digits.replace(/\./g, "").replace(",", ".") : digits;
  const number = Number(normalized);
  return Number.isFinite(number) ? number.toFixed(2) : digits;
}

function dateKeys(iso: string | null | undefined) {
  if (!iso) return [];
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return [];
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const nl = MONTHS.split("|")[month - 1];
  return [`${day}-${month}`, `${day}/${month}`, `${day}.${month}`, `${day} ${nl}`];
}

function normalizeDate(value: string) {
  const lower = value.toLowerCase().replace(/\s+/g, " ").trim();
  const numeric = /^(\d{1,2})[-/.](\d{1,2})/.exec(lower);
  if (numeric) return `${Number(numeric[1])}-${Number(numeric[2])}`;
  const named = /^(\d{1,2}) (\w+)/.exec(lower);
  if (!named) return lower;
  const index = MONTHS.split("|").indexOf(named[2]);
  if (index < 0) return lower;
  // Na de twaalf Nederlandse maanden: january, february, march, may, june, july, august, october.
  const month = index >= 12 ? [1, 2, 3, 5, 6, 7, 8, 10][index - 12] : index + 1;
  return `${Number(named[1])}-${month}`;
}

export function checkDraftFacts(input: FactCheckInput): FactIssue[] {
  const issues: FactIssue[] = [];
  const allowedText = `${input.customerText}\n${input.sourceText}`;
  const allowedCompact = compact(allowedText);
  const orders = [input.order, ...(input.candidates ?? [])].filter((o): o is FactCheckOrder => Boolean(o));
  const push = (kind: FactIssue["kind"], value: string) => {
    if (!issues.some((issue) => issue.kind === kind && issue.value === value)) issues.push({ kind, value });
  };

  const knownOrders = new Set(orders.map((o) => compact(o.displayName)));
  const knownCodes = new Set(orders.flatMap((o) => o.fulfillments.map((f) => compact(f.trackingNumber ?? ""))).filter(Boolean));
  const knownUrls = orders.flatMap((o) => o.fulfillments.map((f) => f.trackingUrl ?? "")).filter(Boolean);
  const knownAmounts = new Set(orders.flatMap((o) => [o.totalAmount, ...o.items.map((i) => i.unitPrice ?? NaN)]).filter(Number.isFinite).map((n) => n.toFixed(2)));
  const knownDates = new Set(orders.flatMap((o) => [
    ...dateKeys(o.orderCreatedAt),
    ...o.items.flatMap((i) => dateKeys(i.latestDeliveryAt)),
    ...o.fulfillments.flatMap((f) => [...dateKeys(f.shipmentDate), ...dateKeys(f.latestTransportEventAt)]),
  ]).map(normalizeDate));
  const allowedDates = new Set((allowedText.match(DATE) ?? []).map(normalizeDate));
  const allowedAmounts = new Set((allowedText.match(AMOUNT) ?? []).map(moneyKey));
  const hasDeliveryDate = orders.some((o) => o.items.some((i) => i.latestDeliveryAt));

  for (const ref of input.draft.match(ORDER_REF) ?? []) {
    if (!knownOrders.has(compact(ref)) && !allowedCompact.includes(compact(ref))) push("order", ref);
  }
  for (const code of input.draft.match(CODE) ?? []) {
    const key = compact(code);
    if (!knownCodes.has(key) && !knownOrders.has(key) && !allowedCompact.includes(key)) push("tracking", code);
  }
  for (const url of input.draft.match(URL) ?? []) {
    if (!/track|trace|zending|shipment/i.test(url)) continue;
    const ok = knownUrls.some((known) => url.startsWith(known)) || [...knownCodes].some((code) => compact(url).includes(code)) || allowedText.includes(url);
    if (!ok) push("url", url);
  }
  for (const amount of input.draft.match(AMOUNT) ?? []) {
    const key = moneyKey(amount);
    if (!knownAmounts.has(key) && !allowedAmounts.has(key)) push("amount", amount.trim());
  }
  for (const date of input.draft.match(DATE) ?? []) {
    const key = normalizeDate(date);
    if (!knownDates.has(key) && !allowedDates.has(key)) push("date", date.trim());
  }
  if (!hasDeliveryDate) {
    for (const promise of input.draft.match(PROMISE) ?? []) push("promise", promise.trim());
  }
  return issues;
}

/** Leesbare samenvatting voor de redenen bij een beslissing. */
export function describeFactIssues(issues: FactIssue[]) {
  const labels: Record<FactIssue["kind"], string> = { order: "bestelnummer", tracking: "trackingcode", url: "trackinglink", amount: "bedrag", date: "datum", promise: "leverbelofte" };
  return issues.map((issue) => `${labels[issue.kind]} niet in de bronnen: ${issue.value}`).join("; ");
}
