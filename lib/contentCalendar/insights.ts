import { listPosts, updatePost } from "./db";
import { dueSnapshot, publishedAt, scorePost } from "./performance.ts";
import { metaConfig } from "./publisher";
import type { MetricSnapshot, Post, PostMetrics, SnapshotKey } from "./types";

/**
 * Haalt de cijfers van gepubliceerde posts op bij Meta en bewaart ze op de post
 * (content_posts.data.metrics). Volledige cijfers (bereik, saves, shares) vragen
 * het recht instagram_manage_insights op de token; zonder dat recht komen alleen
 * likes en reacties binnen.
 */
const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const MAX_PER_TICK = 4;

// Van uitgebreid naar minimaal: niet elke metric bestaat voor elk mediatype of elke API-versie
const IG_METRIC_SETS = [
  ["reach", "saved", "shares", "views", "follows", "profile_visits"],
  ["reach", "saved", "shares"],
];

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(data.error?.message ?? `Meta request mislukt (${response.status})`) as Error & { code?: number };
    error.code = data.error?.code;
    throw error;
  }
  return data;
}

type InsightRow = { name: string; values?: Array<{ value: number }>; total_value?: { value: number } };

function readInsights(rows: InsightRow[]) {
  return Object.fromEntries(rows.map((row) => [row.name, row.total_value?.value ?? row.values?.[0]?.value ?? 0])) as Record<string, number>;
}

/** Permissiefout (code 10 of 200-299): het insights-recht ontbreekt. */
function isPermissionError(error: unknown) {
  const code = (error as { code?: number }).code ?? 0;
  return code === 10 || (code >= 200 && code < 300);
}

async function instagramMetrics(mediaId: string, token: string) {
  const basic = await graphGet(mediaId, { fields: "like_count,comments_count", access_token: token });
  const result: Omit<MetricSnapshot, "at" | "ageHours"> = { likes: basic.like_count ?? 0, comments: basic.comments_count ?? 0 };
  let insights: PostMetrics["insights"] = "basic";
  for (const metrics of IG_METRIC_SETS) {
    try {
      const data = await graphGet(`${mediaId}/insights`, { metric: metrics.join(","), access_token: token });
      const values = readInsights(data.data ?? []);
      Object.assign(result, {
        reach: values.reach, saves: values.saved, shares: values.shares,
        ...(values.views !== undefined ? { views: values.views } : {}),
        ...(values.follows !== undefined ? { follows: values.follows } : {}),
        ...(values.profile_visits !== undefined ? { profileVisits: values.profile_visits } : {}),
      });
      insights = "full";
      break;
    } catch (error) {
      if (isPermissionError(error)) break; // geen recht: blijft bij likes en reacties
    }
  }
  return { result, insights };
}

async function facebookMetrics(postId: string, token: string) {
  const data = await graphGet(postId, { fields: "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares", access_token: token });
  return { fbReactions: data.reactions?.summary?.total_count ?? 0, fbComments: data.comments?.summary?.total_count ?? 0, fbShares: data.shares?.count ?? 0 };
}

async function measure(post: Post, token: string) {
  const at = new Date().toISOString();
  const ageHours = Math.round(((Date.now() - new Date(publishedAt(post) ?? at).getTime()) / 3_600_000) * 10) / 10;
  let snapshot: MetricSnapshot = { at, ageHours, likes: 0, comments: 0 };
  let insights: PostMetrics["insights"] = post.metrics?.insights ?? "basic";
  if (post.publish?.instagram?.id) {
    const ig = await instagramMetrics(post.publish.instagram.id, token);
    snapshot = { ...snapshot, ...ig.result };
    insights = ig.insights;
  }
  if (post.publish?.facebook?.id) {
    try { snapshot = { ...snapshot, ...(await facebookMetrics(post.publish.facebook.id, token)) }; } catch (error) { console.error(`[insights] Facebook ${post.id}`, error); }
  }
  return { snapshot, insights };
}

/** Herberekent score en label van alle gemeten posts; slaat alleen wijzigingen op. */
async function rescore(posts: Post[]) {
  const measured = posts.filter((p) => p.metrics);
  const viral: Post[] = [];
  for (const post of measured) {
    const result = scorePost(post, measured);
    const score = result?.score;
    const label = result?.label;
    if (score === post.metrics?.score && label === post.metrics?.label) continue;
    await updatePost(post.id, (current) => ({ metrics: current.metrics ? { ...current.metrics, score, label } : current.metrics }));
    if (label === "viral" && post.metrics?.label !== "viral") viral.push(post);
  }
  return viral;
}

async function saveSnapshot(post: Post, key: SnapshotKey | "latest", snapshot: MetricSnapshot, insights: PostMetrics["insights"]) {
  return await updatePost(post.id, (current) => {
    const base: PostMetrics = current.metrics ?? { snapshots: {}, insights, lastCheckedAt: snapshot.at };
    return {
      metrics: {
        ...base,
        snapshots: key === "latest" ? base.snapshots : { ...base.snapshots, [key]: snapshot },
        latest: snapshot,
        insights,
        lastCheckedAt: snapshot.at,
        error: undefined,
      },
    };
  });
}

/** Vanuit de cron: posts meten waarvan een meetmoment (24u, 3d, 7d) aan de beurt is. */
export async function collectDueMetrics(posts?: Post[]) {
  const cfg = metaConfig();
  if (!cfg) return { measured: 0 };
  const all = posts ?? (await listPosts());
  const due = all.filter((p) => p.status === "posted" && dueSnapshot(p)).slice(0, MAX_PER_TICK);
  const updated: Post[] = [];
  for (const post of due) {
    const key = dueSnapshot(post)!;
    try {
      const { snapshot, insights } = await measure(post, cfg.token);
      updated.push(await saveSnapshot(post, key, snapshot, insights));
    } catch (error) {
      console.error(`[insights] ${post.id} meten mislukt`, error);
      await updatePost(post.id, (current) => ({ metrics: { ...(current.metrics ?? { snapshots: {}, insights: "basic" }), lastCheckedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) } }));
    }
  }
  if (!updated.length) return { measured: 0 };
  const fresh = all.map((p) => updated.find((u) => u.id === p.id) ?? p);
  const viral = await rescore(fresh);
  return { measured: updated.length, viral: viral.map((p) => p.id) };
}

/** Handmatig verversen: de laatste stand van recente posts (laatste 30 dagen, max 20). */
export async function refreshRecentMetrics() {
  const cfg = metaConfig();
  if (!cfg) throw new Error("Meta is niet gekoppeld");
  const all = await listPosts();
  const recent = all
    .filter((p) => p.status === "posted" && publishedAt(p) && Date.now() - new Date(publishedAt(p)!).getTime() < 30 * 86_400_000)
    .slice(-20);
  const updated: Post[] = [];
  for (const post of recent) {
    try {
      const { snapshot, insights } = await measure(post, cfg.token);
      // een meetmoment dat net aan de beurt is, telt meteen mee
      updated.push(await saveSnapshot(post, dueSnapshot(post) ?? "latest", snapshot, insights));
    } catch (error) {
      console.error(`[insights] ${post.id} verversen mislukt`, error);
    }
  }
  await rescore(all.map((p) => updated.find((u) => u.id === p.id) ?? p));
  return { refreshed: updated.length, insights: updated[0]?.metrics?.insights ?? null };
}
