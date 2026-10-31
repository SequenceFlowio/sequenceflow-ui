import assert from "node:assert/strict";
import test from "node:test";

import { amsterdamNow, assignPillars, buildSlots, isDue } from "../lib/contentCalendar/planning.ts";

test("buildSlots plans only the chosen weekdays", () => {
  // 2 november 2026 is a Monday
  const slots = buildSlots({ startDate: "2026-11-02", weeks: 2, weekdays: [1, 3, 5], time: "12:00" });
  assert.deepEqual(slots.map((slot) => slot.date), ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13"]);
  assert.ok(slots.every((slot) => slot.time === "12:00"));
});

test("assignPillars never repeats a pillar back to back and keeps promotion rare", () => {
  const pillars = assignPillars(40, []);
  assert.equal(pillars.length, 40);
  for (let i = 1; i < pillars.length; i++) assert.notEqual(pillars[i], pillars[i - 1]);
  assert.ok(pillars.filter((pillar) => pillar === "product").length <= 40 / 8);
});

test("amsterdamNow uses Dutch time, including daylight saving", () => {
  assert.equal(amsterdamNow(new Date("2026-07-01T10:00:00Z")), "2026-07-01 12:00");
  assert.equal(amsterdamNow(new Date("2026-12-01T10:00:00Z")), "2026-12-01 11:00");
});

test("isDue only publishes approved posts whose moment has passed", () => {
  const options = { maxAttempts: 3, retryAfterMs: 600_000, nowMs: Date.parse("2026-11-02T12:00:00Z") };
  const post = { status: "approved" as const, date: "2026-11-02", time: "12:00" };
  assert.equal(isDue(post, "2026-11-02 12:00", options), true);
  assert.equal(isDue(post, "2026-11-02 11:59", options), false);
  assert.equal(isDue({ ...post, status: "review" as const }, "2026-11-03 09:00", options), false);
  // a recent failed attempt waits, too many attempts stop
  assert.equal(isDue({ ...post, publish: { attempts: 1, lastAttemptAt: "2026-11-02T11:55:00Z" } }, "2026-11-02 13:00", options), false);
  assert.equal(isDue({ ...post, publish: { attempts: 3, lastAttemptAt: "2026-11-01T00:00:00Z" } }, "2026-11-02 13:00", options), false);
});
