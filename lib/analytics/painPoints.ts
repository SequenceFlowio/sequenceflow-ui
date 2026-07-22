import { normalizeLearningText } from "../agentProfile/learning.ts";

export type PainPointPeriod = "daily" | "weekly" | "monthly" | "quarterly";

export type PainPointSource = {
  subject: string | null;
  body_text: string | null;
  created_at: string;
};

export type PainPoint = {
  category: string;
  count: number;
  percentage: number;
  description: string;
  recommended_action: string;
};

const REPLY_MARKERS = [
  /^-{2,}\s*(?:original message|oorspronkelijk bericht)\s*-{2,}$/i,
  /^on .+ wrote:$/i,
  /^op .+ schreef .+:$/i,
  /^(?:from|van):\s+/i,
];

export const PAIN_POINT_PERIOD_DAYS: Record<PainPointPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
};

export const PAIN_POINT_CACHE_MS: Record<PainPointPeriod, number> = {
  daily: 60 * 60 * 1000,
  weekly: 6 * 60 * 60 * 1000,
  monthly: 24 * 60 * 60 * 1000,
  quarterly: 24 * 60 * 60 * 1000,
};

function stripReplyHistory(value: string) {
  const kept: string[] = [];
  for (const line of value.replace(/\r\n/g, "\n").split("\n")) {
    if (REPLY_MARKERS.some((marker) => marker.test(line.trim()))) break;
    if (!line.trim().startsWith(">")) kept.push(line);
  }
  return kept.join("\n");
}

export function sanitizePainPointSource(source: PainPointSource) {
  const subject = normalizeLearningText(stripReplyHistory(source.subject ?? "")).slice(0, 180);
  const message = normalizeLearningText(stripReplyHistory(source.body_text ?? "")).slice(0, 700);
  if (!subject && !message) return null;
  return { subject: subject || "(geen onderwerp)", message, created_at: source.created_at };
}

export function evenlySample<T>(items: T[], limit: number) {
  if (limit <= 0) return [];
  if (items.length <= limit) return [...items];
  if (limit === 1) return [items[0]];
  return Array.from({ length: limit }, (_, index) => items[Math.round(index * (items.length - 1) / (limit - 1))]);
}

function cleanAnalysisText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return normalizeLearningText(value)
    .replace(/[“”„‟«»]/g, "")
    .replace(/^['\"]+|['\"]+$/g, "")
    .slice(0, maxLength)
    .trim();
}

export function parsePainPointAnalysis(value: unknown, sampledTicketCount: number) {
  const parsed = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawPoints = Array.isArray(parsed.pain_points) ? parsed.pain_points.slice(0, 7) : [];
  const seen = new Set<string>();
  const points: Omit<PainPoint, "percentage">[] = [];

  for (const rawPoint of rawPoints) {
    const row = rawPoint && typeof rawPoint === "object" ? rawPoint as Record<string, unknown> : {};
    const category = cleanAnalysisText(row.category, 80);
    const description = cleanAnalysisText(row.description, 320);
    const recommendedAction = cleanAnalysisText(row.recommended_action, 280);
    const count = Math.round(Number(row.count));
    const key = category.toLocaleLowerCase("nl-NL");
    if (!category || !description || !recommendedAction || !Number.isFinite(count) || count <= 0 || seen.has(key)) continue;
    seen.add(key);
    points.push({ category, description, recommended_action: recommendedAction, count });
  }

  const countedTickets = points.reduce((sum, point) => sum + point.count, 0);
  if (!points.length || sampledTicketCount <= 0 || countedTickets !== sampledTicketCount) {
    throw new Error("Pain point analysis did not account for every sampled ticket");
  }

  const intro = cleanAnalysisText(parsed.intro, 600);
  if (!intro) throw new Error("Pain point analysis is missing its briefing");

  return {
    intro,
    pain_points: points.map((point) => ({
      ...point,
      percentage: Math.round((point.count / sampledTicketCount) * 100),
    })),
  };
}

export function painPointPeriodForDays(days: 7 | 30 | 90): PainPointPeriod {
  if (days === 7) return "weekly";
  if (days === 90) return "quarterly";
  return "monthly";
}
