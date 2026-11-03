import crypto from "crypto";

import { NextResponse } from "next/server";

import { aiProviderIssueMessage, classifyAiProviderIssue } from "@/lib/ai/providerAvailability";
import { ASSISTANT_DAILY_LIMIT, askVera, assistantQuestionsToday } from "@/lib/inventory/assistant";
import { assistantSuggestions, parseAssistantMessages } from "@/lib/inventory/assistantCore";
import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET: the example questions. */
export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  const language = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "nl";
  return NextResponse.json({ suggestions: assistantSuggestions(language), dailyLimit: ASSISTANT_DAILY_LIMIT });
}

/**
 * POST /api/inventory/vera/chat: { messages, language } → { answer, proposals, grounded }.
 * Vera reads through tools and only proposes changes; confirming a proposal
 * calls the normal endpoints with this user's own rights.
 */
export async function POST(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as { messages?: unknown; language?: unknown };
  const language = body.language === "en" ? "en" : "nl";
  let messages;
  try {
    messages = parseAssistantMessages(body.messages);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ongeldige vraag." }, { status: 400 });
  }
  const { tenantId, role } = access.context;
  const userId = access.context.userId ?? "unknown";
  try {
    if (await assistantQuestionsToday(tenantId, userId) >= ASSISTANT_DAILY_LIMIT) {
      return NextResponse.json({ error: language === "nl" ? `Je hebt vandaag ${ASSISTANT_DAILY_LIMIT} vragen aan Vera gesteld. Morgen kan het weer.` : `You asked Vera ${ASSISTANT_DAILY_LIMIT} questions today. Try again tomorrow.`, retryable: false }, { status: 429 });
    }
    const result = await askVera({ tenantId, userId, messages, language, canManage: role === "admin", requestId: crypto.randomUUID() });
    return NextResponse.json({ answer: result.answer, proposals: result.proposals, grounded: result.grounded, ungrounded: result.ungrounded, toolsUsed: result.toolsUsed });
  } catch (error) {
    const issue = classifyAiProviderIssue(error);
    if (issue) return NextResponse.json({ error: aiProviderIssueMessage(issue, language), retryable: issue === "rate_limit" }, { status: 503 });
    return inventoryError(error, "vera/chat");
  }
}
