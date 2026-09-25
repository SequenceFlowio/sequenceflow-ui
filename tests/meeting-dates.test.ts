import assert from "node:assert/strict";
import test from "node:test";
import { amsterdamToday, nextMeetingWorkdays, isAvailableMeetingDay } from "../lib/marketing/meetingDates.ts";

test("meeting days advance through weekends and month boundaries", () => {
  assert.deepEqual(nextMeetingWorkdays("2026-09-25", 4), ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
  assert.deepEqual(nextMeetingWorkdays("2026-10-15", 2), ["2026-10-16", "2026-10-19"]);
});

test("Amsterdam date governs availability even for visitors in other time zones", () => {
  const now = new Date("2026-09-25T22:30:00Z");
  assert.equal(amsterdamToday(now), "2026-09-26");
  assert.equal(isAvailableMeetingDay("2026-09-28", now), true);
  assert.equal(isAvailableMeetingDay("2026-09-25", now), false);
  assert.equal(isAvailableMeetingDay("2026-09-27", now), false);
  assert.equal(isAvailableMeetingDay("2026-10-12", now), false);
});
