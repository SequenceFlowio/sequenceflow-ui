import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  analyticsDateKeys,
  classifyHandlingStatus,
  clampRate,
  parseAnalyticsDays,
} from "../lib/analytics/core.ts";
import {
  evenlySample,
  parsePainPointAnalysis,
  sanitizePainPointSource,
} from "../lib/analytics/painPoints.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("analytics windows accept only supported periods", () => {
  assert.equal(parseAnalyticsDays("7"), 7);
  assert.equal(parseAnalyticsDays("90"), 90);
  assert.equal(parseAnalyticsDays("365"), 30);
  assert.equal(analyticsDateKeys(7, new Date("2026-07-22T20:00:00Z")).length, 7);
});

test("handling states and rates preserve their actual meaning", () => {
  assert.equal(classifyHandlingStatus("sent"), "resolved");
  assert.equal(classifyHandlingStatus("pending_autosend"), "review");
  assert.equal(classifyHandlingStatus("escalated"), "escalated");
  assert.equal(classifyHandlingStatus("ignored"), "ignored");
  assert.equal(clampRate(8, 10), 0.8);
  assert.equal(clampRate(0, 0), null);
  assert.equal(clampRate(12, 10), 1);
});

test("pain point sources remove signatures, reply history, and direct identifiers", () => {
  const sanitized = sanitizePainPointSource({
    subject: "Vraag order #AB-123 voor klant@example.nl",
    body_text: "Hallo, bel 06 12345678 over postcode 1234 AB.\n\nMet vriendelijke groet\nSophie\n\nOn Monday wrote:\n> oude tekst",
    created_at: "2026-07-22T10:00:00Z",
  });
  assert.ok(sanitized);
  assert.doesNotMatch(`${sanitized.subject} ${sanitized.message}`, /example\.nl|1234 AB|12345678|Sophie|oude tekst/i);
  assert.match(`${sanitized.subject} ${sanitized.message}`, /\[order\]|\[email\]|\[telefoon\]|\[postcode\]/);
});

test("pain point sampling spans the complete period", () => {
  const sample = evenlySample(Array.from({ length: 200 }, (_, index) => index), 75);
  assert.equal(sample.length, 75);
  assert.equal(sample[0], 0);
  assert.equal(sample.at(-1), 199);
  assert.ok(sample[37] > 90 && sample[37] < 110);
});

test("pain point output must account for every sampled case and stores no quote", () => {
  const parsed = parsePainPointAnalysis({
    intro: "Retouren vragen aandacht. Verbeter vandaag de bevestiging.",
    pain_points: [
      { category: "Retour blijft stil", count: 3, description: "Klanten missen voortgang.", recommended_action: "Stuur een statusupdate." },
      { category: "Pakket vertraagd", count: 2, description: "Leveringen komen later.", recommended_action: "Toon de actuele levertijd.", example: "letterlijke quote" },
    ],
  }, 5);
  assert.deepEqual(parsed.pain_points.map((point) => point.percentage), [60, 40]);
  assert.equal("example" in parsed.pain_points[1], false);
  assert.throws(() => parsePainPointAnalysis({ intro: "Test", pain_points: [{ category: "A", count: 2, description: "B", recommended_action: "C" }] }, 3));
});

test("pain point persistence has a period key and removes legacy quotes", () => {
  const migration = source("supabase/migrations/041_analytics_reliability.sql");
  const route = source("app/api/analytics/pain-points/route.ts");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS period/);
  assert.match(migration, /UNIQUE INDEX[\s\S]+tenant_period/);
  assert.match(migration, /point - 'example'/);
  assert.match(route, /eq\("analysis_version", 2\)/);
  assert.match(route, /sampled_ticket_count/);
  assert.doesNotMatch(route, /"example"/);
});

test("analytics UI and APIs expose partial failures and honest samples", () => {
  const page = source("app/(app)/analytics/AnalyticsDashboard.tsx");
  const overview = source("app/api/analytics/overview/route.ts");
  const volume = source("app/api/analytics/volume/route.ts");
  const operations = source("app/api/analytics/operations/route.ts");
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /SectionError/);
  assert.match(page, /analytics-status/);
  assert.match(overview, /latest_decision_id/);
  assert.match(overview, /autoResolveRate: clampRate\(autoSentCount/);
  assert.match(volume, /classifyHandlingStatus/);
  assert.doesNotMatch(volume, /human_review/);
  assert.match(operations, /contextMatchRate: clampRate/);
  assert.match(operations, /samples:/);
});
