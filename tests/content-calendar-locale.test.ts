import test from "node:test";
import assert from "node:assert/strict";

import { byLocale, englishId, localNow, localeOf, parseLocale, translatable } from "../lib/contentCalendar/locale.ts";
import { isDue, takenSlots } from "../lib/contentCalendar/planning.ts";

test("posts without a locale are Dutch", () => {
  assert.equal(localeOf({}), "nl");
  assert.equal(localeOf({ locale: "en" }), "en");
  assert.equal(parseLocale("EN"), "nl");
  assert.equal(parseLocale("en"), "en");
});

test("each locale uses its own clock", () => {
  const winter = new Date("2026-12-01T17:00:00Z");
  assert.equal(localNow("nl", winter), "2026-12-01 18:00");
  assert.equal(localNow("en", winter), "2026-12-01 12:00");
  // zomertijd: Amsterdam UTC+2, New York UTC-4
  const summer = new Date("2026-07-01T17:00:00Z");
  assert.equal(localNow("nl", summer), "2026-07-01 19:00");
  assert.equal(localNow("en", summer), "2026-07-01 13:00");
});

test("an English 19:00 post is due on New York time, not Amsterdam time", () => {
  const post = { status: "approved" as const, date: "2026-12-01", time: "19:00" };
  const at = new Date("2026-12-01T19:30:00Z"); // 20:30 in Amsterdam, 14:30 in New York
  const opts = { maxAttempts: 3, retryAfterMs: 0, nowMs: at.getTime() };
  assert.equal(isDue(post, localNow("nl", at), opts), true);
  assert.equal(isDue(post, localNow("en", at), opts), false);
});

test("only Dutch carousels are translated; reels and stories are not", () => {
  assert.equal(translatable({}), true);
  assert.equal(translatable({ kind: "carousel" }), true);
  assert.equal(translatable({ kind: "reel" }), false);
  assert.equal(translatable({ kind: "story" }), false);
  assert.equal(translatable({ locale: "en" }), false);
  assert.equal(englishId("ab12cd34"), "ab12cd34-en");
});

test("English posts do not take Dutch slots", () => {
  const posts = [
    { date: "2026-12-01", time: "19:00" },
    { date: "2026-12-02", time: "19:00", locale: "en" as const },
  ];
  const taken = takenSlots(byLocale(posts, "nl"));
  assert.equal(taken.has("2026-12-01 19:00"), true);
  assert.equal(taken.has("2026-12-02 19:00"), false);
});
