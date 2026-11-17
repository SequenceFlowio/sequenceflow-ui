import assert from "node:assert/strict";
import test from "node:test";

import { chunkPlan, tiktokText } from "../lib/contentCalendar/tiktokFormat.ts";

test("TikTok text stays within the photo title and video caption limits", () => {
  const post = { headline: "x".repeat(120), caption: "c".repeat(3000), hashtags: ["#webshop", "#sequenceflow"] };
  const text = tiktokText(post);
  assert.ok(text.photoTitle.length <= 90);
  assert.ok(text.photoDescription.length <= 4000);
  assert.ok(text.videoTitle.length <= 2200);
  assert.ok(text.videoTitle.endsWith("#webshop #sequenceflow"));
  const short = tiktokText({ headline: "Kort", caption: "Tekst", hashtags: ["#a"] });
  assert.equal(short.photoTitle, "Kort");
  assert.equal(short.videoTitle, "Tekst\n\n#a");
});

test("chunkPlan uploads up to 64 MB in one go and splits larger files", () => {
  assert.deepEqual(chunkPlan(3 * 1024 * 1024), { chunkSize: 3 * 1024 * 1024, count: 1 });
  assert.deepEqual(chunkPlan(60 * 1024 * 1024), { chunkSize: 60 * 1024 * 1024, count: 1 });
  const big = chunkPlan(105 * 1024 * 1024);
  assert.equal(big.chunkSize, 10 * 1024 * 1024);
  assert.equal(big.count, 10); // de laatste chunk neemt de rest (15 MB)
});
