import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the inbox uses one localized vocabulary and keeps configuration out of the work queue", () => {
  const page = source("app/(app)/inbox/page.tsx");
  const dutch = source("lib/i18n/dictionaries/nl.ts");

  assert.match(dutch, /decisionTitle: "Inbox"/);
  assert.doesNotMatch(dutch, /Beslis-Inbox/);
  assert.doesNotMatch(page, /t\.inbox\.queueSummaryTitle/);
  assert.match(page, /t\.inbox\.queueReview/);
  // De cijferstrook (gemiddelde zekerheid, handmatige beoordeling, vandaag
  // verzonden) en het statuspaneel zijn bewust weggehaald.
  assert.doesNotMatch(page, /sf-inbox-signals/);
  assert.doesNotMatch(page, /sf-inbox-health/);
  assert.doesNotMatch(page, /t\.inbox\.averageConfidence/);
  assert.doesNotMatch(page, /\{ label: "(?:Review|Sent|Escalated)"/);
  assert.doesNotMatch(page, />\s*(?:Queue|Avg\. Confidence|No data|Needs Human|Auto-sent Today)\s*</);
});
