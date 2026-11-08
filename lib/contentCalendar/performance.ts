import type { MetricSnapshot, PerformanceLabel, Post, PostMetrics, SnapshotKey } from "./types.ts";

/**
 * Prestaties van gepubliceerde posts, zonder API's: wanneer meten, hoe scoren,
 * wat is viraal, en welke formats en pijlers de generator vaker moet kiezen.
 * Score = hoe een post het doet ten opzichte van de mediaan van dit account op
 * hetzelfde meetmoment (1 = gemiddeld, 2 = twee keer zo goed).
 */

export const SNAPSHOTS: Array<{ key: SnapshotKey; hours: number }> = [
  { key: "24h", hours: 24 },
  { key: "72h", hours: 72 },
  { key: "7d", hours: 168 },
];

/** Minimaal zoveel andere posts met cijfers voordat een score iets zegt. */
export const MIN_BASELINE = 3;
export const VIRAL_RATIO = 2;

export function publishedAt(post: Pick<Post, "publish">) {
  return post.publish?.instagram?.at ?? post.publish?.facebook?.at ?? null;
}

/** Het eerstvolgende meetmoment dat aan de beurt is, of null. */
export function dueSnapshot(post: Pick<Post, "publish" | "metrics">, nowMs = Date.now()): SnapshotKey | null {
  const at = publishedAt(post);
  if (!at) return null;
  const age = (nowMs - new Date(at).getTime()) / 3_600_000;
  const due = SNAPSHOTS.filter((s) => age >= s.hours && !post.metrics?.snapshots[s.key]);
  return due.length ? due[due.length - 1].key : null; // gemist (cron stil)? dan het meest recente
}

/** Saves en shares wegen zwaarder dan likes: die zeggen dat de post echt waarde had. */
export function weightedEngagement(s: MetricSnapshot) {
  return s.likes + 2 * s.comments + 3 * (s.saves ?? 0) + 4 * (s.shares ?? 0) + 5 * (s.follows ?? 0)
    + (s.fbReactions ?? 0) + 2 * (s.fbComments ?? 0) + 4 * (s.fbShares ?? 0);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Het rijpste meetmoment van een post (7d boven 72h boven 24h). */
export function bestSnapshot(metrics?: PostMetrics): { key: SnapshotKey; snapshot: MetricSnapshot } | null {
  for (const key of ["7d", "72h", "24h"] as SnapshotKey[]) {
    const snapshot = metrics?.snapshots[key];
    if (snapshot) return { key, snapshot };
  }
  return null;
}

export function labelFor(score: number): PerformanceLabel {
  if (score >= VIRAL_RATIO) return "viral";
  if (score >= 1.25) return "boven";
  if (score >= 0.75) return "gemiddeld";
  return "onder";
}

/** Score van één post tegen de andere posts op hetzelfde meetmoment. */
export function scorePost(post: Pick<Post, "id" | "metrics">, all: Array<Pick<Post, "id" | "metrics">>) {
  const own = bestSnapshot(post.metrics);
  if (!own) return null;
  const others = all.filter((p) => p.id !== post.id).map((p) => p.metrics?.snapshots[own.key]).filter((s): s is MetricSnapshot => Boolean(s));
  if (others.length < MIN_BASELINE) return null;
  const ratios: number[] = [];
  const engagementBase = median(others.map(weightedEngagement));
  ratios.push((weightedEngagement(own.snapshot) + 1) / (engagementBase + 1));
  const reaches = others.map((s) => s.reach).filter((r): r is number => typeof r === "number");
  if (typeof own.snapshot.reach === "number" && reaches.length >= MIN_BASELINE) ratios.push((own.snapshot.reach + 1) / (median(reaches) + 1));
  const score = Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) / 100;
  return { score, label: labelFor(score), key: own.key };
}

/**
 * Self-healing: per format of pijler een vermenigvuldiger voor de planner.
 * Pas vanaf 3 gescoorde posts in een groep, en begrensd zodat alles af en toe blijft terugkomen.
 */
export function performanceBoost(posts: Array<Pick<Post, "pillar" | "format" | "metrics">>, field: "pillar" | "format") {
  const groups = new Map<string, number[]>();
  for (const post of posts) {
    const score = post.metrics?.score;
    if (typeof score !== "number") continue;
    const key = field === "format" ? post.format ?? "tips" : post.pillar;
    groups.set(key, [...(groups.get(key) ?? []), score]);
  }
  const boost: Record<string, number> = {};
  for (const [key, scores] of groups) {
    if (scores.length < 3) continue;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    boost[key] = Math.min(1.8, Math.max(0.6, Math.round(mean * 100) / 100));
  }
  return boost;
}
