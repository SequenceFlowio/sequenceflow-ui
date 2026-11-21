import assert from "node:assert/strict";
import test from "node:test";

import { chunkPlan, tiktokText } from "../lib/contentCalendar/tiktokFormat.ts";

test("TikTok text stays within the photo title and video caption limits", () => {
  const post = { headline: "x".repeat(120), caption: "c".repeat(3000), hashtags: ["#webshop", "#sequenceflow"] };
  const text = tiktokText(post);
  assert.ok(text.photoTitle.length <= 90);
  assert.ok(text.photoDescription.length <= 4000);
  assert.ok(text.videoTitle.length <= 2200);
  assert.ok(!text.videoTitle.includes("#"));
  const short = tiktokText({ headline: "Kort", caption: "Tekst" });
  assert.equal(short.photoTitle, "Kort");
  assert.equal(short.videoTitle, "Tekst");
});

test("chunkPlan uploads up to 64 MB in one go and splits larger files", () => {
  assert.deepEqual(chunkPlan(3 * 1024 * 1024), { chunkSize: 3 * 1024 * 1024, count: 1 });
  assert.deepEqual(chunkPlan(60 * 1024 * 1024), { chunkSize: 60 * 1024 * 1024, count: 1 });
  const big = chunkPlan(105 * 1024 * 1024);
  assert.equal(big.chunkSize, 10 * 1024 * 1024);
  assert.equal(big.count, 10); // de laatste chunk neemt de rest (15 MB)
});

test("TikTok direct post: user must choose visibility; nothing is preselected", async () => {
  const { EMPTY_TIKTOK, validateTikTok, canPostDirect } = await import("../lib/contentCalendar/tiktokFormat.ts");
  assert.equal(EMPTY_TIKTOK.privacyLevel, undefined);
  assert.equal(EMPTY_TIKTOK.allowComment || EMPTY_TIKTOK.allowDuet || EMPTY_TIKTOK.allowStitch || EMPTY_TIKTOK.disclose, false);
  assert.match(validateTikTok(EMPTY_TIKTOK)!, /Choose who can view/);
  const ok = { ...EMPTY_TIKTOK, privacyLevel: "PUBLIC_TO_EVERYONE" };
  assert.equal(validateTikTok(ok, ["PUBLIC_TO_EVERYONE", "SELF_ONLY"]), null);
  assert.match(validateTikTok(ok, ["SELF_ONLY"])!, /isn't available/);
  // zonder bevestiging gaat de post naar de inbox
  assert.equal(canPostDirect({ tiktok: ok }), false);
  assert.equal(canPostDirect({ tiktok: { ...ok, confirmedAt: "2026-11-19T10:00:00Z" } }), true);
  assert.equal(canPostDirect({}), false);
});

test("TikTok commercial content disclosure follows TikTok's rules", async () => {
  const { EMPTY_TIKTOK, validateTikTok, tiktokContentLabel, directPostInfo, sanitizeTikTok } = await import("../lib/contentCalendar/tiktokFormat.ts");
  const base = { ...EMPTY_TIKTOK, privacyLevel: "SELF_ONLY", disclose: true };
  assert.match(validateTikTok(base)!, /promotes yourself, a third party/);
  assert.equal(validateTikTok({ ...base, yourBrand: true }), null);
  assert.match(validateTikTok({ ...base, brandedContent: true })!, /cannot be set to private/);
  assert.equal(tiktokContentLabel({ disclose: true, yourBrand: true, brandedContent: false }), "Promotional content");
  assert.equal(tiktokContentLabel({ disclose: true, yourBrand: true, brandedContent: true }), "Paid partnership");
  assert.equal(tiktokContentLabel({ disclose: false, yourBrand: true, brandedContent: true }), null);
  const info = directPostInfo({ ...EMPTY_TIKTOK, privacyLevel: "PUBLIC_TO_EVERYONE", allowComment: true, disclose: true, brandedContent: true }, true);
  assert.deepEqual(info, { privacy_level: "PUBLIC_TO_EVERYONE", disable_comment: false, disable_duet: true, disable_stitch: true, brand_content_toggle: true, brand_organic_toggle: false });
  assert.equal("disable_duet" in directPostInfo({ ...EMPTY_TIKTOK, privacyLevel: "SELF_ONLY" }, false), false);
  // brand-vinkjes tellen alleen als melden aan staat
  assert.equal(sanitizeTikTok({ disclose: false, yourBrand: true, privacyLevel: "SELF_ONLY", hack: 1 })!.yourBrand, false);
});
