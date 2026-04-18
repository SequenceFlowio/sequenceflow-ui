import type { AiDecision } from "@/types/aiInbox";

const VALID_DECISIONS = new Set(["inform_customer", "ask_question", "escalate", "ignore"]);

export function extractJsonObject(raw: string): unknown {
  const cleaned = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    return {};
  }
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try stripping literal control characters that AIs sometimes embed in strings
    try {
      return JSON.parse(jsonStr.replace(/[\u0000-\u001F]/g, (c) =>
        c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : ""
      ));
    } catch {
      return {};
    }
  }
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

  const intent =
    typeof parsed.intent === "string" && parsed.intent.trim()
      ? parsed.intent.trim()
      : "general";

  const rawConfidence =
    typeof parsed.confidence === "number"
      ? parsed.confidence
      : typeof parsed.confidence === "string"
        ? parseFloat(parsed.confidence)
        : NaN;
  const confidence = isNaN(rawConfidence) ? 0.5 : Math.max(0, Math.min(1, rawConfidence));

  const decisionStr = String(parsed.decision ?? "");
  const decision = VALID_DECISIONS.has(decisionStr)
    ? (decisionStr as AiDecision["decision"])
    : "inform_customer";

  const requiresHuman =
    typeof parsed.requires_human === "boolean"
      ? parsed.requires_human
      : String(parsed.requires_human ?? "").toLowerCase() === "true";

  const draft = parsed.draft && typeof parsed.draft === "object" ? parsed.draft : {};
  const draftSubject = typeof draft.subject === "string" ? draft.subject.trim() : "";
  const draftBody = typeof draft.body === "string" ? draft.body.trim() : "";
  const draftLanguage = typeof draft.language === "string" && draft.language.trim()
    ? draft.language.trim()
    : "unknown";

  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map((r: unknown) => String(r))
    : [];

  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

  return {
    intent,
    confidence,
    decision,
    requires_human: requiresHuman,
    reasons,
    draft: { subject: draftSubject, body: draftBody, language: draftLanguage },
    actions: actions as AiDecision["actions"],
  };
}
