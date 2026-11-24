import assert from "node:assert/strict";
import test from "node:test";

import { pickZernioAccount, zernioPostBody, zernioTikTokStatus, zernioUsername } from "../lib/contentCalendar/zernioFormat.ts";

test("Zernio picks the TikTok account of each language", () => {
  assert.equal(zernioUsername("nl", {}), "sequenceflownl");
  assert.equal(zernioUsername("en", {}), "sequenceflow.io");
  assert.equal(zernioUsername("en", { ZERNIO_TIKTOK_EN: "@Other" }), "other");
  const accounts = [
    { _id: "a", platform: "instagram", username: "sequenceflownl" },
    { _id: "b", platform: "tiktok", username: "sequenceflownl" },
    { _id: "c", platform: "tiktok", username: "@sequenceflow.io" },
  ];
  assert.equal(pickZernioAccount(accounts, "sequenceflownl")?._id, "b");
  assert.equal(pickZernioAccount(accounts, "sequenceflow.io")?._id, "c");
  assert.equal(pickZernioAccount(accounts, "unknown"), null);
});

test("Zernio body posts publicly and right away, video and photos", () => {
  const post = { headline: "Kop", caption: "Caption zonder hashtags" };
  const video = zernioPostBody(post, "acc", { video: "https://media.example/v/x.mp4?sig=1" });
  assert.equal(video.publishNow, true);
  assert.equal(video.content, "Caption zonder hashtags");
  assert.deepEqual(video.mediaItems, [{ type: "video", url: "https://media.example/v/x.mp4?sig=1" }]);
  assert.equal(video.tiktokSettings.privacy_level, "PUBLIC_TO_EVERYONE");
  assert.equal(video.tiktokSettings.content_preview_confirmed, true);
  assert.equal(video.tiktokSettings.express_consent_given, true);
  const photos = zernioPostBody(post, "acc", { images: ["https://x/1.jpg", "https://x/2.jpg"] });
  assert.equal(photos.content, "Kop");
  assert.equal(photos.mediaItems.length, 2);
  const settings = photos.tiktokSettings as Record<string, unknown>;
  assert.equal(settings.media_type, "photo");
  assert.equal(settings.description, "Caption zonder hashtags");
});

test("Zernio status maps to our TikTok status", () => {
  assert.equal(zernioTikTokStatus({ status: "published", platforms: [{ platform: "tiktok", status: "published" }] }).status, "published");
  assert.equal(zernioTikTokStatus({ status: "publishing", platforms: [{ platform: "tiktok", status: "uploading" }] }).status, "processing");
  const failed = zernioTikTokStatus({ status: "failed", platforms: [{ platform: "tiktok", status: "failed", errorMessage: "Video te kort" }] });
  assert.deepEqual(failed, { status: "failed", error: "Video te kort" });
  assert.equal(zernioTikTokStatus({ status: "scheduled" }).status, "processing");
});
