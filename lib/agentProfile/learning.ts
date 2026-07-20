import crypto from "crypto";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ORDER_REF = /(?:\b(?:order|bestelling|ordernummer|bestelnummer)\s*(?:(?:nr\.?|nummer)\s*)?[:#-]?\s*#?(?=[A-Z0-9-]{3,}\b)(?=[A-Z0-9-]*\d)[A-Z0-9-]+|#(?=[A-Z0-9-]{3,}\b)(?=[A-Z0-9-]*\d)[A-Z0-9-]+)/gi;
const PHONE = /(?:\+31|0031|0)[\s().-]*(?:\d[\s().-]*){8,10}\b/g;
const URL = /https?:\/\/\S+|www\.\S+/gi;
const DUTCH_POSTCODE = /\b\d{4}\s?[A-Z]{2}\b/gi;
const TRACKING_REF = /\b(?:tracking|track\s*&\s*trace|zending|pakketcode)\s*[:#-]?\s*[A-Z0-9-]{6,}\b/gi;
const ADDRESS_FIELD = /\b(?:adres|address|straat|street|postcode|postal code)\s*:\s*[^\n,.!?]+/gi;
const GREETING_NAME = /^(\s*(?:beste|hallo|hoi|hi|dear)\s+)[^,\n]{2,50}(,?)/gim;

function stripSignature(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const marker = lines.findIndex((line) => /^(met vriendelijke groet|vriendelijke groet|groet|kind regards|best regards|regards)[,!]?$/i.test(line.trim()));
  return (marker >= 0 ? lines.slice(0, marker) : lines).join("\n");
}

export function normalizeLearningText(text: string) {
  return stripSignature(text)
    .replace(GREETING_NAME, "$1[naam]$2")
    .replace(EMAIL, "[email]")
    .replace(ORDER_REF, "[order]")
    .replace(TRACKING_REF, "[tracking]")
    .replace(PHONE, "[telefoon]")
    .replace(DUTCH_POSTCODE, "[postcode]")
    .replace(ADDRESS_FIELD, "[adres]")
    .replace(URL, "[url]")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizedEditDistance(ai: string, human: string) {
  const left = normalizeLearningText(ai).split(/\s+/).filter(Boolean);
  const right = normalizeLearningText(human).split(/\s+/).filter(Boolean);
  if (left.length === 0 && right.length === 0) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return Math.min(1, previous[right.length] / Math.max(left.length, right.length, 1));
}

export function normalizedLearningDiff(ai: string, human: string) {
  const before = normalizeLearningText(ai);
  const after = normalizeLearningText(human);
  const beforeTokens = before.split(/\s+/).filter(Boolean);
  const afterTokens = after.split(/\s+/).filter(Boolean);
  const beforeCounts = new Map<string, number>();
  const afterCounts = new Map<string, number>();
  for (const token of beforeTokens) beforeCounts.set(token, (beforeCounts.get(token) ?? 0) + 1);
  for (const token of afterTokens) afterCounts.set(token, (afterCounts.get(token) ?? 0) + 1);
  const removed = beforeTokens.filter((token) => {
    const count = afterCounts.get(token) ?? 0;
    if (count <= 0) return true;
    afterCounts.set(token, count - 1);
    return false;
  });
  const added = afterTokens.filter((token) => {
    const count = beforeCounts.get(token) ?? 0;
    if (count <= 0) return true;
    beforeCounts.set(token, count - 1);
    return false;
  });
  return { before, after, removed, added };
}

export function learningContentHash(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function sanitizeReusableLearningRule(value: string) {
  const sanitized = normalizeLearningText(value).slice(0, 1000);
  return sanitized && !/\[(?:naam|email|order|tracking|telefoon|postcode|adres|url)\]/i.test(sanitized)
    ? sanitized
    : null;
}

export type LearningClassification = {
  classification: "fact" | "policy" | "tone" | "structure" | "other";
  candidate_rule: string | null;
  confidence: number;
};

export function parseLearningClassification(value: unknown): LearningClassification {
  const parsed = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const allowed = new Set<LearningClassification["classification"]>(["fact", "policy", "tone", "structure", "other"]);
  const rawClassification = String(parsed.classification ?? "other") as LearningClassification["classification"];
  const candidate = typeof parsed.candidate_rule === "string" ? sanitizeReusableLearningRule(parsed.candidate_rule) : null;
  const confidence = Number(parsed.confidence ?? 0);
  return {
    classification: allowed.has(rawClassification) ? rawClassification : "other",
    candidate_rule: candidate,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
  };
}
