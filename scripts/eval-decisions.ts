/**
 * Live evaluation of the decision model on the golden set, without touching a
 * database: builds the same prompts as the pipeline (no knowledge, no profile,
 * no commerce context) and compares intent, decision, requires_human and the
 * draft language with what tests/fixtures/decision-golden.json expects.
 *
 * Run locally with an OpenAI key:
 *   OPENAI_API_KEY=sk-... node --experimental-strip-types scripts/eval-decisions.ts [--model gpt-4.1-mini] [--only id]
 *
 * It prints one line per case and a summary; exit code 1 when a case fails.
 * Add a case for every mistake seen in production; never a real customer's text.
 */
import { readFileSync } from "node:fs";
import OpenAI from "openai";

import { buildDecisionSystemPrompt, buildDecisionUserPrompt } from "../lib/ai/decision/buildDecisionPrompt.ts";
import { extractJsonObject, validateDecision } from "../lib/ai/decision/validateDecision.ts";
import { unverifiedCommerceClaims } from "../lib/commerce/claims.ts";
import { normalizeLanguage } from "../lib/language/normalizeLanguage.ts";

type Expect = { intent?: string[]; decision?: string[]; requiresHuman?: boolean; noDiscount?: boolean; language?: string };
type GoldenCase = { id: string; email?: { from: string; name?: string; subject: string; text: string }; expect?: Expect };

const args = process.argv.slice(2);
const model = args.includes("--model") ? args[args.indexOf("--model") + 1] : "gpt-4.1-mini";
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const golden = JSON.parse(readFileSync(new URL("../tests/fixtures/decision-golden.json", import.meta.url), "utf8")) as { cases: GoldenCase[] };
const cases = golden.cases.filter((item) => item.email && item.expect && (!only || item.id === only));

const runtime = {
  templates: [],
  config: { languageDefault: "nl", empathyEnabled: true, allowDiscount: false, maxDiscountAmount: 0, escalationDepartments: [], replyTone: "friendly_informal", replyPronounPreference: "informal", signature: "", autosendEnabled: false, autosendThreshold: 0.9 },
} as unknown as Parameters<typeof buildDecisionSystemPrompt>[0];

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for the live evaluation.");
  const openai = new OpenAI();
  let failed = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  for (const item of cases) {
    const email = item.email!;
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildDecisionSystemPrompt(runtime, "No knowledge documents uploaded for this evaluation.") },
        { role: "user", content: buildDecisionUserPrompt({ subject: email.subject, body: email.text, customerEmail: email.from, customerName: email.name ?? null, receivedAt: new Date().toISOString(), fallbackReplyLanguage: "nl" }) },
      ],
      max_completion_tokens: 900,
    });
    promptTokens += completion.usage?.prompt_tokens ?? 0;
    completionTokens += completion.usage?.completion_tokens ?? 0;
    const decision = validateDecision(extractJsonObject(completion.choices[0]?.message?.content ?? ""));
    const expect = item.expect!;
    const problems: string[] = [];
    if (expect.intent && !expect.intent.includes(decision.intent)) problems.push(`intent ${decision.intent} not in ${expect.intent.join("/")}`);
    if (expect.decision && !expect.decision.includes(decision.decision)) problems.push(`decision ${decision.decision} not in ${expect.decision.join("/")}`);
    if (expect.requiresHuman !== undefined && decision.requires_human !== expect.requiresHuman) problems.push(`requires_human ${decision.requires_human}`);
    if (expect.language && normalizeLanguage(decision.draft.language) !== expect.language) problems.push(`language ${decision.draft.language}`);
    if (expect.noDiscount && /korting|discount|\d+\s?%/i.test(decision.draft.body)) problems.push("draft offers a discount");
    const claims = unverifiedCommerceClaims(decision.draft.body, { cancelledAt: null, financialStatus: "PAID", fulfillmentStatus: null, hasFulfillment: false });
    if (claims.length) problems.push(`unverified claims: ${claims.join(", ")} (the pipeline would block this draft)`);
    const ok = problems.length === 0;
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${item.id.padEnd(28)} intent=${decision.intent} decision=${decision.decision} human=${decision.requires_human} conf=${decision.confidence} lang=${decision.draft.language}${problems.length ? `\n      ${problems.join("; ")}` : ""}`);
  }
  console.log(`\n${cases.length - failed}/${cases.length} passed · model ${model} · ${promptTokens} prompt + ${completionTokens} completion tokens`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
