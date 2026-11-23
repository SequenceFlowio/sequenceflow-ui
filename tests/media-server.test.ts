import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { postIdFromVideoFile, signedDeleteRequest, signedMediaServerUrl, verifyMediaSignature } from "../lib/contentCalendar/mediaServerCore.ts";

const NOW = Date.parse("2026-11-23T10:00:00Z");

test("een ondertekende link klopt tot hij verloopt", () => {
  const url = new URL(signedMediaServerUrl("https://media.sequenceflow.io/", "geheim", "abc-reel.mp4", 3600, NOW));
  assert.equal(url.origin + url.pathname, "https://media.sequenceflow.io/v/abc-reel.mp4");
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig")!;
  assert.equal(verifyMediaSignature("geheim", "abc-reel.mp4", exp, sig, NOW), true);
  assert.equal(verifyMediaSignature("geheim", "abc-reel.mp4", exp, sig, NOW + 3601_000), false, "verlopen");
  assert.equal(verifyMediaSignature("ander", "abc-reel.mp4", exp, sig, NOW), false, "andere sleutel");
  assert.equal(verifyMediaSignature("geheim", "xyz-reel.mp4", exp, sig, NOW), false, "ander bestand");
  assert.equal(verifyMediaSignature("geheim", "abc-reel.mp4", exp + 1, sig, NOW), false, "langer geldig gemaakt");
});

test("alleen veilige bestandsnamen", () => {
  assert.throws(() => signedMediaServerUrl("https://m", "s", "../etc/passwd", 60, NOW));
  assert.equal(verifyMediaSignature("s", "../x.mp4", 9_999_999_999, "x", NOW), false);
});

test("de verwijderopdracht gebruikt dezelfde opbouw als de server", () => {
  const request = signedDeleteRequest("geheim", ["a-reel.mp4", "b-reel.mp4"], NOW);
  const expected = createHmac("sha256", "geheim").update(`del:a-reel.mp4,b-reel.mp4:${request.ts}`).digest("base64url");
  assert.equal(request.sig, expected);
});

test("post-id uit de bestandsnaam van een reel", () => {
  assert.equal(postIdFromVideoFile("2026-11-24-0900-nl-reel.mp4"), "2026-11-24-0900-nl");
  assert.equal(postIdFromVideoFile("cover.jpg"), null);
});
