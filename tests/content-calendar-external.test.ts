import test from "node:test";
import assert from "node:assert/strict";

import { externalPost } from "../lib/contentCalendar/external.ts";

test("an Instagram post placed by hand becomes a posted calendar item on local time", () => {
  const post = externalPost({ id: "1789", caption: "Zo plan je je week\nMeer tekst hier\n\n#ondernemen #webshop", media_type: "CAROUSEL_ALBUM", timestamp: "2026-11-18T17:30:00+0000", permalink: "https://instagram.com/p/x" }, "nl")!;
  assert.equal(post.id, "ig-1789");
  assert.equal(post.status, "posted");
  assert.equal(post.kind, "carousel");
  assert.equal(post.date, "2026-11-18");
  assert.equal(post.time, "18:30");
  assert.equal(post.headline, "Zo plan je je week");
  assert.deepEqual(post.hashtags, ["#ondernemen", "#webshop"]);
  assert.equal(post.caption, "Zo plan je je week\nMeer tekst hier");
  assert.equal(post.publish?.instagram?.id, "1789");
  assert.equal(post.locale, undefined);
});

test("reels are recognised and English ones use New York time", () => {
  const post = externalPost({ id: "2", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-11-18T17:30:00+0000", thumbnail_url: "https://cdn/x.jpg" }, "en")!;
  assert.equal(post.kind, "reel");
  assert.equal(post.locale, "en");
  assert.equal(post.time, "12:30");
  assert.equal(post.headline, "Reel op Instagram");
  assert.equal(post.external?.thumbnail, "https://cdn/x.jpg");
});
