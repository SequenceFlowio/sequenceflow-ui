/**
 * Live testset voor Support One (docs/plan-werkstroomkern.md, fase 0b).
 *
 * Bouwt van een verzonnen geval dezelfde invoer als de pipeline (runtime,
 * kennis, agentprofiel, commerce-context) en beoordeelt de uitkomst met vaste
 * regels. Puur: geen netwerk, geen database, zodat tests het kunnen draaien.
 */
import type { TenantRuntime } from "@/lib/tenants/loadTenantRuntime";
import type { CommerceResolution } from "@/lib/commerce/resolution";
import type { CommerceOrderContext } from "@/lib/commerce/types";
import { assertiveMatch, unverifiedCommerceClaims, type CommerceClaimFacts } from "../../lib/commerce/claims.ts";
import { detectLanguage } from "../../lib/language/detectLanguage.ts";

export type EvalShop = {
  name: string;
  provider: "shopify" | "bol";
  actionMode: "disabled" | "approval_required";
  signature: string;
  languageDefault: string;
  replyTone: string;
  pronoun: "formal" | "informal";
  empathyEnabled: boolean;
  allowDiscount: boolean;
  maxDiscountAmount: number;
  knowledge: string[];
};

export type EvalOrder = {
  number: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  cancelable?: boolean;
  items: Array<{ title: string; quantity: number }>;
  fulfillments?: Array<{ status: string; trackingCompany: string; trackingNumber: string }>;
  returns?: Array<{ title: string; handled: boolean }>;
};

export type EvalExpect = {
  decision?: string[];
  requiresHuman?: boolean;
  mustIncludeAny?: string[];
  mustNotMatch?: string[];
  actions?: "none" | "cancel_order";
  formal?: boolean;
  language?: string;
};

export type EvalCase = {
  id: string;
  shop: string;
  expectIntent: string;
  email: { from: string; name?: string; subject: string; text: string };
  order?: EvalOrder;
  /** none: koppeling maar geen bestelling gevonden; multiple: meerdere kandidaten; unconnected: winkel zonder koppeling. */
  commerce?: "none" | "multiple" | "unconnected";
  expect: EvalExpect;
};

export type EvalFile = {
  version: number;
  receivedAt: string;
  shops: Record<string, EvalShop>;
  cases: EvalCase[];
};

/** Wat het model teruggeeft, na `validateDecision`. */
export type EvalOutput = {
  intent: string;
  decision: string;
  requires_human: boolean;
  draft: { body: string; language: string };
  actions: Array<{ type: string }>;
};

export type CheckResult = {
  name: string;
  ok: boolean;
  /** Een kritieke fout bereikt (zonder vangnet) een klant of doet iets onomkeerbaars. */
  critical: boolean;
  /** De pipeline zou dit al tegenhouden (statuscheck, annuleren altijd naar een mens). */
  caughtByGuard?: boolean;
  detail?: string;
};

export function toRuntime(key: string, shop: EvalShop): TenantRuntime {
  return {
    tenantId: `eval-${key}`,
    plan: "pro",
    config: {
      empathyEnabled: shop.empathyEnabled,
      allowDiscount: shop.allowDiscount,
      maxDiscountAmount: shop.maxDiscountAmount,
      signature: shop.signature,
      languageDefault: shop.languageDefault,
      autosendEnabled: false,
      autosendThreshold: 0.85,
      autosendTime1: "",
      autosendTime2: "",
      replyTone: shop.replyTone,
      replyPronounPreference: shop.pronoun,
      escalationDepartments: [],
      senderEmail: null,
      senderName: shop.name,
    },
    templates: [],
    channel: { inboundAddress: `${key}@inbox.example`, outboundFromEmail: `support@${key}.example`, outboundFromName: shop.name },
  };
}

/** Zelfde opmaak als retrieveKnowledgeContext: stukken gescheiden door ---. */
export function toKnowledgeContext(shop: EvalShop) {
  return shop.knowledge.join("\n\n---\n\n");
}

/** Minimale versie van het agentprofiel, zodat het model weet voor welke winkel het schrijft. */
export function toAgentProfileContext(shop: EvalShop) {
  return [
    "AGENT PROFILE — mined from this business's own support history and human-approved.",
    "This section overrides the generic tone settings above.",
    "",
    "IDENTITY & VOICE",
    `- Business: ${shop.name}`,
    `- Dutch form of address: ${shop.pronoun === "formal" ? "u" : "je"}.`,
    "- Do NOT add a sign-off; the application appends their signature automatically.",
  ].join("\n");
}

function toOrderContext(shop: EvalShop, order: EvalOrder, receivedAt: string): CommerceOrderContext {
  return {
    id: `order-${order.number}`,
    connectionId: "eval-connection",
    provider: shop.provider,
    externalId: order.number,
    displayName: order.number,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalAmount: order.totalAmount,
    currencyCode: "EUR",
    cancelable: order.cancelable ?? false,
    cancelledAt: null,
    orderCreatedAt: receivedAt,
    lastSyncedAt: receivedAt,
    matchMethod: "order_number",
    matchConfidence: 1,
    items: order.items.map((item, index) => ({
      id: `item-${index}`, title: item.title, variantTitle: null, sku: null, quantity: item.quantity, ean: null,
      offerExternalId: null, unitPrice: null, fulfilmentMethod: null, fulfilmentDistributionParty: null,
      cancellationRequested: false, latestDeliveryAt: null,
    })),
    fulfillments: (order.fulfillments ?? []).map((item, index) => ({
      id: `fulfillment-${index}`, status: item.status, trackingCompany: item.trackingCompany, trackingNumber: item.trackingNumber,
      trackingUrl: null, shipmentDate: receivedAt, transportStatusCode: null, transportStatusDescription: null, latestTransportEventAt: null,
    })),
    returns: (order.returns ?? []).map((item, index) => ({
      id: `return-${index}`, externalId: `return-${index}`, registeredAt: receivedAt, fulfilmentMethod: null, handled: item.handled,
      items: [{
        externalId: `return-item-${index}`, title: item.title, ean: null, expectedQuantity: 1,
        handledQuantity: item.handled ? 1 : 0, handled: item.handled, handlingResult: null, reason: null,
      }],
    })),
    offers: [],
  };
}

/** Wat de pipeline als commerce-resolutie zou vinden; null = geen winkelkoppeling. */
export function toResolution(shop: EvalShop, item: EvalCase, receivedAt: string): CommerceResolution | null {
  if (item.commerce === "unconnected") return null;
  if (item.order) {
    return { provider: shop.provider, connectionStatus: "active", actionMode: shop.actionMode, order: toOrderContext(shop, item.order, receivedAt), candidates: [] };
  }
  if (item.commerce === "multiple") {
    const a = toOrderContext(shop, { number: "#9001", financialStatus: "PAID", fulfillmentStatus: "UNFULFILLED", totalAmount: 20, items: [{ title: "Product A", quantity: 1 }] }, receivedAt);
    const b = toOrderContext(shop, { number: "#9002", financialStatus: "PAID", fulfillmentStatus: "FULFILLED", totalAmount: 30, items: [{ title: "Product B", quantity: 1 }] }, receivedAt);
    return { provider: shop.provider, connectionStatus: "active", actionMode: shop.actionMode, order: null, candidates: [a, b] };
  }
  return { provider: shop.provider, connectionStatus: "active", actionMode: shop.actionMode, order: null, candidates: [] };
}

/** Zelfde feiten die de pipeline aan unverifiedCommerceClaims geeft. */
export function toFacts(resolution: CommerceResolution | null): CommerceClaimFacts {
  const order = resolution?.order;
  if (!order) return null;
  return { cancelledAt: order.cancelledAt, financialStatus: order.financialStatus, fulfillmentStatus: order.fulfillmentStatus, hasFulfillment: order.fulfillments.length > 0 };
}

/** Een zin zonder aanspreekvorm is ook goed; alleen je/jij/jouw is fout bij een u-winkel. */
const INFORMAL = /\b(je|jij|jouw)\b/i;

export function scoreCase(expect: EvalExpect, output: EvalOutput, facts: CommerceClaimFacts, provider: EvalShop["provider"]): CheckResult[] {
  const body = output.draft.body ?? "";
  const checks: CheckResult[] = [];
  const claims = output.decision === "ignore" ? [] : unverifiedCommerceClaims(body, facts);
  const blockedByStatusCheck = claims.length > 0;
  checks.push({ name: "geen onbewezen status", ok: !blockedByStatusCheck, critical: true, caughtByGuard: blockedByStatusCheck, detail: claims.join(", ") || undefined });

  if (expect.decision) {
    checks.push({ name: "beslissing", ok: expect.decision.includes(output.decision), critical: false, detail: output.decision });
  }
  if (expect.requiresHuman !== undefined) {
    const proposesCancel = output.actions.some((action) => action.type === "cancel_order");
    const ok = output.requires_human === expect.requiresHuman;
    checks.push({
      name: expect.requiresHuman ? "naar een mens" : "zelfstandig mogelijk",
      ok,
      critical: expect.requiresHuman,
      caughtByGuard: !ok && expect.requiresHuman && proposesCancel,
      detail: `requires_human=${output.requires_human}`,
    });
  }
  if (expect.actions === "none") {
    const ok = output.actions.length === 0;
    checks.push({ name: "geen actie", ok, critical: true, caughtByGuard: !ok && provider === "bol", detail: output.actions.map((a) => a.type).join(", ") || undefined });
  } else if (expect.actions === "cancel_order") {
    checks.push({ name: "annuleervoorstel", ok: output.actions.some((a) => a.type === "cancel_order"), critical: false });
  }
  if (expect.mustIncludeAny?.length && output.decision !== "ignore") {
    const lower = body.toLowerCase();
    const hit = expect.mustIncludeAny.find((needle) => lower.includes(needle.toLowerCase()));
    checks.push({ name: "noemt het juiste feit", ok: Boolean(hit), critical: false, detail: hit ?? `geen van: ${expect.mustIncludeAny.join(" | ")}` });
  }
  for (const pattern of expect.mustNotMatch ?? []) {
    // Zelfde zinslogica als de statuscheck: een vraag of voorwaarde beweert niets.
    const match = assertiveMatch(body, new RegExp(pattern, "i"));
    checks.push({ name: "verboden bewering", ok: !match, critical: true, detail: match ?? undefined });
  }
  if (expect.formal && output.decision !== "ignore" && body) {
    checks.push({ name: "u-vorm", ok: !INFORMAL.test(body), critical: false });
  }
  if (expect.language && output.decision !== "ignore" && body) {
    const detected = detectLanguage(body)?.language ?? null;
    checks.push({ name: "taal", ok: detected === null || detected === expect.language, critical: false, detail: detected ?? "onbepaald" });
  }
  // Houdt de statuscheck het concept tegen, dan vervangt de pipeline het door
  // een terugvalconcept dat altijd naar een mens gaat: elke kritieke fout is dan gevangen.
  if (blockedByStatusCheck) {
    for (const check of checks) if (!check.ok && check.critical) check.caughtByGuard = true;
  }
  // Gaat het concept toch al naar een mens, dan leest die mee voordat er iets verstuurd wordt.
  if (output.requires_human) {
    for (const check of checks) if (!check.ok && check.critical && check.name !== "naar een mens") check.caughtByGuard = true;
  }
  return checks;
}

export type CaseResult = {
  id: string;
  shop: string;
  expectIntent: string;
  modelIntent: string | null;
  decision: string | null;
  requiresHuman?: boolean;
  /** Concepttekst; mag in het rapport omdat alle gevallen verzonnen zijn. */
  draft?: string;
  checks: CheckResult[];
  error?: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export function casePassed(result: CaseResult) {
  return !result.error && result.checks.every((check) => check.ok);
}

/** Kritiek én niet al gevangen door een vangnet in de pipeline. */
export function uncaughtCritical(result: CaseResult) {
  if (result.error) return [];
  return result.checks.filter((check) => !check.ok && check.critical && !check.caughtByGuard);
}

export function summarize(results: CaseResult[]) {
  const byIntent = new Map<string, { total: number; passed: number }>();
  for (const result of results) {
    const row = byIntent.get(result.expectIntent) ?? { total: 0, passed: 0 };
    row.total += 1;
    if (casePassed(result)) row.passed += 1;
    byIntent.set(result.expectIntent, row);
  }
  const passed = results.filter(casePassed).length;
  return {
    total: results.length,
    passed,
    errors: results.filter((r) => r.error).length,
    uncaughtCritical: results.flatMap((r) => uncaughtCritical(r).map((check) => ({ id: r.id, check: check.name, detail: check.detail }))),
    caughtByGuard: results.flatMap((r) => r.checks.filter((c) => !c.ok && c.caughtByGuard).map((c) => ({ id: r.id, check: c.name }))),
    byIntent: [...byIntent.entries()].map(([intent, row]) => ({ intent, ...row })).sort((a, b) => a.intent.localeCompare(b.intent)),
  };
}
