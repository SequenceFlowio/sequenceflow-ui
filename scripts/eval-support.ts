/**
 * Live testset voor Support One: draait verzonnen klantmails door hetzelfde
 * prompt en model als de pipeline en beoordeelt de concepten met vaste regels.
 *
 *   npm run eval:support                    alle gevallen
 *   npm run eval:support -- --only=pw-      alleen gevallen waarvan de id zo begint
 *   npm run eval:support -- --model=gpt-4.1 ander model proberen
 *
 * Kost een paar cent per run (OpenAI). Zit daarom niet in `npm test`.
 * Exitcode 1 als er een kritieke fout is die geen vangnet in de pipeline tegenhoudt.
 * Zie docs/plan-werkstroomkern.md.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import OpenAI from "openai";

import { DECISION_MODEL } from "../lib/ai/models.ts";
import { buildDecisionSystemPrompt, buildDecisionUserPrompt } from "../lib/ai/decision/buildDecisionPrompt.ts";
import { extractJsonObject, validateDecision } from "../lib/ai/decision/validateDecision.ts";
import { buildCommercePromptContext } from "../lib/commerce/promptContext.ts";
import { modelPrice, USD_TO_EUR } from "../lib/internal/costs.ts";
import { detectLanguage } from "../lib/language/detectLanguage.ts";
import {
  casePassed, factIssuesFor, intentCorrect, scoreCase, summarize, toAgentProfileContext, toFacts, toKnowledgeContext, toResolution, toRuntime, uncaughtCritical,
  type CaseResult, type EvalCase, type EvalFile,
} from "../evals/support/harness.ts";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));
const model = args.model || DECISION_MODEL;
const only = args.only || "";
const concurrency = Math.max(1, Math.min(8, Number(args.concurrency) || 4));

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY ontbreekt. Draai via `npm run eval:support` (leest .env.local).");
  process.exit(2);
}

const file = JSON.parse(readFileSync(new URL("../evals/support/cases.json", import.meta.url), "utf8")) as EvalFile;
const cases = file.cases.filter((item) => item.id.startsWith(only));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runCase(item: EvalCase): Promise<CaseResult> {
  const shop = file.shops[item.shop];
  if (!shop) throw new Error(`Onbekende winkel ${item.shop} in ${item.id}`);
  const runtime = toRuntime(item.shop, shop);
  const resolution = toResolution(shop, item, file.receivedAt);
  const base = { id: item.id, shop: item.shop, expectIntent: item.expectIntent, modelIntent: null, decision: null, checks: [], inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildDecisionSystemPrompt(runtime, toKnowledgeContext(shop), toAgentProfileContext(shop), buildCommercePromptContext(resolution)) },
        {
          role: "user",
          content: buildDecisionUserPrompt({
            subject: item.email.subject,
            body: item.email.text,
            customerEmail: item.email.from,
            customerName: item.email.name ?? null,
            receivedAt: file.receivedAt,
            detectedCustomerLanguage: detectLanguage(`${item.email.subject}\n${item.email.text}`)?.language ?? null,
            fallbackReplyLanguage: shop.languageDefault,
            regenerationInstructions: null,
          }),
        },
      ],
      max_completion_tokens: 900,
    });
    const usage = {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      cachedTokens: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    };
    let decision;
    try {
      decision = validateDecision(extractJsonObject(completion.choices[0]?.message?.content ?? ""));
    } catch (error) {
      return { ...base, ...usage, error: `ongeldige uitvoer: ${error instanceof Error ? error.message : String(error)}` };
    }
    return {
      ...base,
      ...usage,
      modelIntent: decision.intent,
      intentOk: intentCorrect(item, decision.intent),
      decision: decision.decision,
      requiresHuman: decision.requires_human,
      draft: decision.draft.body,
      checks: scoreCase(item.expect, decision, toFacts(resolution), shop.provider, factIssuesFor(item, shop, resolution, decision.draft.body)),
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }
}

async function runAll() {
  const results: CaseResult[] = new Array(cases.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, async () => {
    while (next < cases.length) {
      const index = next++;
      results[index] = await runCase(cases[index]);
    }
  }));
  return results;
}

const startedAt = new Date();
const results = await runAll();
const summary = summarize(results);
const price = modelPrice(model);
const tokens = results.reduce((sum, r) => ({ input: sum.input + r.inputTokens, cached: sum.cached + r.cachedTokens, output: sum.output + r.outputTokens }), { input: 0, cached: 0, output: 0 });
const costEur = (((tokens.input - tokens.cached) * price.input + tokens.cached * price.cached + tokens.output * price.output) / 1_000_000) * USD_TO_EUR;

console.log(`\nSupport One live testset · model ${model} · ${results.length} gevallen\n`);
for (const result of results) {
  const failed = result.checks.filter((check) => !check.ok);
  const mark = result.error ? "FOUT" : casePassed(result) ? " ok " : uncaughtCritical(result).length ? "KRIT" : "mis ";
  const why = result.error ?? failed.map((check) => `${check.name}${check.detail ? ` (${check.detail})` : ""}${check.caughtByGuard ? " [vangnet]" : ""}`).join("; ");
  const intentMark = result.intentOk ? " " : "≠";
  console.log(`${mark}  ${result.id.padEnd(26)} soort: ${result.expectIntent.padEnd(16)} model:${intentMark}${(result.modelIntent ?? "-").padEnd(24)} ${why}`);
}
console.log("\nPer verwachte soort vraag:");
for (const row of summary.byIntent) console.log(`  ${row.intent.padEnd(18)} ${row.passed}/${row.total}`);
console.log(`\nSoort vraag goed: ${Math.round(summary.intentAccuracy * 100)}% (doel fase 1: minstens 90%)`);
console.log(`Geslaagd: ${summary.passed}/${summary.total} · fouten: ${summary.errors} · kritiek zonder vangnet: ${summary.uncaughtCritical.length} · gevangen door vangnet: ${summary.caughtByGuard.length}`);
console.log(`Tokens: ${tokens.input} in (${tokens.cached} uit cache), ${tokens.output} uit · kosten ongeveer €${costEur.toFixed(3)}${price.estimate ? " (geschat tarief)" : ""}`);

mkdirSync(new URL("../evals/results/", import.meta.url), { recursive: true });
const reportUrl = new URL(`../evals/results/support-${startedAt.toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(reportUrl, JSON.stringify({ model, startedAt: startedAt.toISOString(), summary, costEur, tokens, results }, null, 2));
console.log(`Rapport: ${reportUrl.pathname}\n`);

process.exit(summary.uncaughtCritical.length ? 1 : 0);
