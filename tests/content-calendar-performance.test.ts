import assert from "node:assert/strict";
import test from "node:test";

import { dueSnapshot, labelFor, performanceBoost, scorePost, weightedEngagement } from "../lib/contentCalendar/performance.ts";
import { assignFormats } from "../lib/contentCalendar/planning.ts";
import type { MetricSnapshot, PostMetrics } from "../lib/contentCalendar/types.ts";

const snap = (likes: number, reach?: number, extra: Partial<MetricSnapshot> = {}): MetricSnapshot => ({ at: "2026-11-02T12:00:00Z", ageHours: 24, likes, comments: 0, reach, ...extra });
const metrics = (s: MetricSnapshot, key: "24h" | "7d" = "24h"): PostMetrics => ({ snapshots: { [key]: s }, insights: "full", lastCheckedAt: s.at });

test("dueSnapshot measures at 24h, 72h and 7d after publishing", () => {
  const publish = { instagram: { id: "1", at: "2026-11-01T11:00:00Z" } };
  const hoursLater = (h: number) => Date.parse("2026-11-01T11:00:00Z") + h * 3_600_000;
  assert.equal(dueSnapshot({ publish }, hoursLater(10)), null);
  assert.equal(dueSnapshot({ publish }, hoursLater(25)), "24h");
  assert.equal(dueSnapshot({ publish, metrics: metrics(snap(1)) }, hoursLater(25)), null);
  // cron stood still: jump to the most recent missing moment
  assert.equal(dueSnapshot({ publish }, hoursLater(200)), "7d");
  assert.equal(dueSnapshot({}, hoursLater(200)), null);
});

test("saves and shares weigh more than likes", () => {
  assert.ok(weightedEngagement(snap(0, undefined, { saves: 1, shares: 1 })) > weightedEngagement(snap(5)));
});

test("a post is scored against the median of the account and flagged viral at 2x", () => {
  const others = [10, 12, 14].map((likes, i) => ({ id: `o${i}`, metrics: metrics(snap(likes, 200)) }));
  const viral = { id: "v", metrics: metrics(snap(40, 700)) };
  const result = scorePost(viral, [...others, viral]);
  assert.ok(result && result.score >= 2);
  assert.equal(result?.label, "viral");
  // not enough baseline yet: no score
  assert.equal(scorePost(viral, [others[0], viral]), null);
  assert.equal(labelFor(1), "gemiddeld");
  assert.equal(labelFor(0.5), "onder");
});

test("performance boost needs three scored posts and stays within bounds", () => {
  const scored = (format: string, score: number) => ({ pillar: "tijd", format, metrics: { ...metrics(snap(1)), score } });
  const boost = performanceBoost([scored("mythe", 3), scored("mythe", 3), scored("mythe", 3), scored("tips", 0.2), scored("tips", 0.2)], "format");
  assert.equal(boost.mythe, 1.8);
  assert.equal(boost.tips, undefined);
  // a boosted format is picked more often
  const plain = assignFormats(40, [], true).filter((f) => f === "mythe").length;
  const boosted = assignFormats(40, [], true, { mythe: 1.8 }).filter((f) => f === "mythe").length;
  assert.ok(boosted > plain);
});
