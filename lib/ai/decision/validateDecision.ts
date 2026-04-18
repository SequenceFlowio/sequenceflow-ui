import type { AiDecision } from "@/types/aiInbox";

const VALID_DECISIONS = new Set(["inform_customer", "ask_question", "escalate", "ignore"]);

export function extractJsonObject(raw: string): unknown {
  const cleaned = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    return {};
  }

  const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonSlice);
  } catch {
    try {
      return JSON.parse(
        jsonSlice.replace(/[\u0000-\u001F]/g, (char) =>
          char === "\n" ? "\\n" : char === "\r" ? "\\r" : char === "\t" ? "\\t" : ""
        )
      );
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
        ? Number(parsed.confidence)
        : Number.NaN;
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0.5;

  const decisionStr = String(parsed.decision ?? "");
  const decision = VALID_DECISIONS.has(decisionStr)
    ? (decisionStr as AiDecision["decision"])
    : "inform_customer";

  const requiresHuman =
    typeof parsed.requires_human === "boolean"
      ? parsed.requires_human
      : typeof parsed.requires_human === "string"
        ? parsed.requires_human.trim().toLowerCase() === "true"
        : true;

  const draft = parsed.draft && typeof parsed.draft === "object" ? parsed.draft : {};
  const draftSubject = typeof draft.subject === "string" ? draft.subject.trim() : "";
  const draftBody = typeof draft.body === "string" ? draft.body.trim() : "";
  const draftLanguage =
    typeof draft.language === "string" && draft.language.trim()
      ? draft.language.trim()
      : "unknown";

  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.map((reason: unknown) => String(reason))
    : [];

  const actions = Array.isArray(parsed.actions)
    ? (parsed.actions as AiDecision["actions"])
    : [];

  return {
    intent,
    confidence,
    decision,
    requires_human: requiresHuman,
    reasons,
    draft: {
      subject: draftSubject,
      body: draftBody,
      language: draftLanguage,
    },
    actions,
  };
}
