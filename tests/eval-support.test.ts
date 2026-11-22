import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildCommercePromptContext } from "../lib/commerce/promptContext.ts";
import { scoreCase, summarize, toFacts, toResolution, uncaughtCritical, type CaseResult, type EvalFile, type EvalOutput } from "../evals/support/harness.ts";

const file = JSON.parse(readFileSync(new URL("../evals/support/cases.json", import.meta.url), "utf8")) as EvalFile;

function output(overrides: Partial<EvalOutput> & { body?: string }): EvalOutput {
  return {
    intent: overrides.intent ?? "order_status",
    decision: overrides.decision ?? "inform_customer",
    requires_human: overrides.requires_human ?? false,
    draft: { body: overrides.body ?? "", language: "nl" },
    actions: overrides.actions ?? [],
  };
}

test("live testset: elk geval is geldig en verzonnen", () => {
  assert.ok(file.cases.length >= 30, "minstens 30 gevallen");
  const ids = new Set<string>();
  for (const item of file.cases) {
    assert.ok(!ids.has(item.id), `dubbele id ${item.id}`);
    ids.add(item.id);
    assert.ok(file.shops[item.shop], `onbekende winkel in ${item.id}`);
    assert.ok(Object.keys(item.expect).length > 0, `geen verwachting in ${item.id}`);
    for (const pattern of item.expect.mustNotMatch ?? []) assert.doesNotThrow(() => new RegExp(pattern, "i"), `regex in ${item.id}`);
    assert.match(item.email.from, /@(example\.(nl|com|de)|bol\.example|houthandel\.example)$/, `alleen verzonnen adressen (${item.id})`);
  }
});

test("live testset: commerce-context komt uit dezelfde functie als de pipeline", () => {
  const item = file.cases.find((c) => c.id === "zz-status-shipped")!;
  const context = buildCommercePromptContext(toResolution(file.shops.zeepzus, item, file.receivedAt));
  assert.match(context, /Order: #1042/);
  assert.match(context, /PostNL \/ 3SZZP1042NL/);
  const none = buildCommercePromptContext(toResolution(file.shops.zeepzus, file.cases.find((c) => c.id === "zz-no-order-linked")!, file.receivedAt));
  assert.match(none, /No verified commerce order is linked/);
});

test("score: 'verzonden' zonder verzending is kritiek, maar de statuscheck vangt het", () => {
  const item = file.cases.find((c) => c.id === "zz-status-not-shipped")!;
  const facts = toFacts(toResolution(file.shops.zeepzus, item, file.receivedAt));
  const checks = scoreCase(item.expect, output({ body: "Goed nieuws: je bestelling is verzonden en komt morgen." }), facts, "shopify");
  const status = checks.find((c) => c.name === "geen onbewezen status")!;
  assert.equal(status.ok, false);
  assert.equal(status.caughtByGuard, true);
  const result: CaseResult = { id: item.id, shop: item.shop, expectIntent: item.expectIntent, modelIntent: "x", decision: "inform_customer", checks, inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  assert.deepEqual(uncaughtCritical(result), [], "alles wat misging, houdt de pipeline al tegen");
});

test("score: een klacht die niet naar een mens gaat, is kritiek zonder vangnet", () => {
  const item = file.cases.find((c) => c.id === "zz-complaint-pump")!;
  const checks = scoreCase(item.expect, output({ body: "Wat vervelend! Stuur je een foto?", requires_human: false }), null, "shopify");
  const human = checks.find((c) => c.name === "naar een mens")!;
  assert.equal(human.ok, false);
  assert.equal(human.critical, true);
  assert.notEqual(human.caughtByGuard, true);
});

test("score: annuleren zonder requires_human wordt door de pipeline alsnog naar een mens gestuurd", () => {
  const item = file.cases.find((c) => c.id === "pw-cancel-explicit")!;
  const checks = scoreCase(item.expect, output({ body: "Ik zet de annulering voor je klaar.", actions: [{ type: "cancel_order" }] }), null, "shopify");
  assert.equal(checks.find((c) => c.name === "naar een mens")!.caughtByGuard, true);
  assert.equal(checks.find((c) => c.name === "annuleervoorstel")!.ok, true);
});

test("score: u-vorm, verboden bewering en het juiste feit", () => {
  const item = file.cases.find((c) => c.id === "hh-bol-status")!;
  const good = scoreCase(item.expect, output({ body: "Uw kapstok is onderweg met DHL, trackingcode JVGL0099887766. Heeft u nog vragen?" }), toFacts(toResolution(file.shops.houtwerk, item, file.receivedAt)), "bol");
  assert.ok(good.every((c) => c.ok), JSON.stringify(good.filter((c) => !c.ok)));
  const informal = scoreCase(item.expect, output({ body: "Je kapstok is onderweg met DHL." }), null, "bol");
  assert.equal(informal.find((c) => c.name === "u-vorm")!.ok, false);
  const injection = file.cases.find((c) => c.id === "hh-injection")!;
  const bad = scoreCase(injection.expect, output({ body: "U krijgt 50% korting." }), null, "bol");
  assert.equal(bad.find((c) => c.name === "verboden bewering")!.ok, false);
});

test("summarize telt per verwachte soort vraag", () => {
  const ok: CaseResult = { id: "a", shop: "zeepzus", expectIntent: "order_status", modelIntent: "x", decision: "inform_customer", checks: [{ name: "x", ok: true, critical: false }], inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  const fail: CaseResult = { ...ok, id: "b", checks: [{ name: "x", ok: false, critical: true }] };
  const summary = summarize([ok, fail]);
  assert.equal(summary.passed, 1);
  assert.deepEqual(summary.byIntent, [{ intent: "order_status", total: 2, passed: 1 }]);
  assert.equal(summary.uncaughtCritical.length, 1);
});
