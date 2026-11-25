import assert from "node:assert/strict";
import test from "node:test";

import { wantsReelStory } from "../lib/contentCalendar/planning.ts";
import type { Post } from "../lib/contentCalendar/types.ts";

const now = Date.parse("2026-11-26T12:00:00Z");
const reel = (extra: Partial<Post> = {}) => ({
  id: "r", kind: "reel", status: "posted", video: { file: "r-reel.mp4" },
  publish: { instagram: { id: "1", at: "2026-11-26T10:00:00Z" } }, ...extra,
}) as unknown as Post;

test("a freshly posted reel also goes up as a story, once", () => {
  assert.equal(wantsReelStory(reel(), now), true);
  assert.equal(wantsReelStory(reel({ publish: { instagram: { id: "1", at: "2026-11-26T10:00:00Z" }, instagramStory: { id: "2", at: "x" } } }), now), false);
  assert.equal(wantsReelStory(reel({ status: "approved" }), now), false);
  assert.equal(wantsReelStory(reel({ kind: "story" } as Partial<Post>), now), false);
  assert.equal(wantsReelStory(reel({ publish: { instagram: { id: "1", at: "2026-11-24T10:00:00Z" } } }), now), false);
  assert.equal(wantsReelStory(reel({ publish: { instagram: { id: "1", at: "2026-11-26T10:00:00Z" }, storyAttempts: 4 } }), now), false);
});
