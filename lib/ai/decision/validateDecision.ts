import type { AiDecision } from "@/types/aiInbox";

const VALID_DECISIONS = new Set(["inform_customer", "ask_question", "escalate", "ignore"]);

export function extractJsonObject(raw: string) {
  const cleaned = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found in AI response.");
  }
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

export function validateDecision(data: unknown): AiDecision {
  const parsed = data as {
    intent?: unknown;
    confidence?: unknown;
    decision?: unknown;
    requires_human?: unknown;
    reasons?: unknown;
    actions?: unknown;
    draft?: { subject?: unknown; body?: unknown; language?: unknown };
  };
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Decision response is not an object.");
  }

  if (typeof parsed.intent !== "string" || !parsed.intent.trim()) {
    throw new Error("Decision response missing intent.");
  }

  if (typeof parsed.confidence !== "number") {
    throw new Error("Decision response missing confidence.");
  }

  if (!VALID_DECISIONS.has(String(parsed.decision))) {
    throw new Error("Decision response contains invalid decision.");
  }

  if (typeof parsed.requires_human !== "boolean") {
    throw new Error("Decision response missing requires_human.");
  }

  if (!parsed.draft || typeof parsed.draft !== "object") {
    throw new Error("Decision response missing draft.");
  }

  if (
    typeof parsed.draft.subject !== "string" ||
    typeof parsed.draft.body !== "string" ||
    typeof parsed.draft.language !== "string"
  ) {
    throw new Error("Decision draft is incomplete.");
  }

  if (!Array.isArray(parsed.reasons)) {
    throw new Error("Decision response missing reasons array.");
  }

  if (!Array.isArray(parsed.actions)) {
    throw new Error("Decision response missing actions array.");
  }

  return {
    intent: parsed.intent.trim(),
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    decision: parsed.decision as AiDecision["decision"],
    requires_human: parsed.requires_human,
    reasons: parsed.reasons.map((reason: unknown) => String(reason)),
    draft: {
      subject: parsed.draft.subject.trim(),
      body: parsed.draft.body.trim(),
      language: parsed.draft.language.trim() || "unknown",
    },
    actions: parsed.actions as AiDecision["actions"],
  };
}
