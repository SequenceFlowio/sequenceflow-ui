import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the inbox uses one localized vocabulary across desktop and mobile", () => {
  const page = source("app/(app)/inbox/page.tsx");
  const dutch = source("lib/i18n/dictionaries/nl.ts");

  assert.match(dutch, /decisionTitle: "Inbox"/);
  assert.doesNotMatch(dutch, /Beslis-Inbox/);
  assert.match(page, /t\.inbox\.queueSummaryTitle/);
  assert.match(page, /t\.inbox\.averageConfidence/);
  assert.match(page, /t\.inbox\.needsHuman/);
  assert.match(page, /t\.inbox\.autoSentToday/);
  assert.match(page, /t\.inbox\.noData/);
  assert.doesNotMatch(page, /\{ label: "(?:Review|Sent|Escalated)"/);
  assert.doesNotMatch(page, />\s*(?:Queue|Avg\. Confidence|No data|Needs Human|Auto-sent Today)\s*</);
});
