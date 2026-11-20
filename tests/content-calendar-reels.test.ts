import test from "node:test";
import assert from "node:assert/strict";

import { REEL_MIX, assignReelTypes, contradictsOwnProduct, keptCarouselIds, reelSlots, reviewConcept } from "../lib/contentCalendar/reelPlan.ts";

test("two reel slots per day per language, skipping taken ones", () => {
  const existing = [{ date: "2026-12-01", time: "12:30", kind: "reel" as const }, { date: "2026-12-01", time: "12:00", kind: "reel" as const, locale: "en" as const }];
  const nl = reelSlots("nl", "2026-12-01", 2, existing);
  assert.deepEqual(nl.map((s) => `${s.date} ${s.time}`), ["2026-12-01 20:00", "2026-12-02 12:30", "2026-12-02 20:00"]);
  const en = reelSlots("en", "2026-12-01", 1, existing);
  assert.deepEqual(en.map((s) => s.time), ["19:00"]);
});

test("reel types follow the mix and never repeat three times in a row", () => {
  const types = assignReelTypes(40, []);
  const share = (t: string) => types.filter((x) => x === t).length / types.length;
  assert.ok(Math.abs(share("tips") - REEL_MIX.tips) < 0.08);
  assert.ok(Math.abs(share("aware") - REEL_MIX.aware) < 0.08);
  for (let i = 2; i < types.length; i++) assert.ok(!(types[i] === types[i - 1] && types[i] === types[i - 2]));
  // een type dat slecht presteert krijgt minder ruimte
  const weak = assignReelTypes(40, [], { aware: 0.6 });
  assert.ok(weak.filter((t) => t === "aware").length < types.filter((t) => t === "aware").length);
});

test("concepts that advise against Support One or name competitors are rejected", () => {
  assert.match(contradictsOwnProduct("Maak een paar sjablonen voor je klantmail")!, /sjablonen/);
  assert.match(contradictsOwnProduct("Save time with canned responses")!, /canned responses/);
  assert.match(contradictsOwnProduct("Let ChatGPT answer your emails")!, /chatgpt/);
  assert.match(contradictsOwnProduct("Gorgias does this too")!, /Gorgias/);
  assert.equal(contradictsOwnProduct("Zet de levertijd bij de bestelknop"), null);
  // 'template' als los woord, niet in 'contemplate'
  assert.equal(contradictsOwnProduct("Contemplate your margins"), null);
});

test("concept review checks uniqueness, dashes and voice length", () => {
  const ok = { topic: "Levertijd op de productpagina", texts: ["Zet de levertijd bij de knop"], voice: ["Waar blijft mijn pakket?"] };
  assert.equal(reviewConcept(ok, ["Retouren beperken met een maattabel"], { maxVoice: 700 }), null);
  assert.match(reviewConcept(ok, ["Levertijd op je productpagina"], { maxVoice: 700 })!, /lijkt te veel op het bestaande onderwerp "Levertijd op je productpagina"/);
  assert.match(reviewConcept({ ...ok, texts: ["Snel — en simpel"] }, [], { maxVoice: 700 })!, /streepje/);
  assert.match(reviewConcept({ ...ok, voice: ["x".repeat(800)] }, [], { maxVoice: 700 })!, /te lang/);
});

test("one carousel per week per language is kept", () => {
  const posts = [
    { id: "a", date: "2026-12-01", time: "08:00", status: "review" as const },
    { id: "b", date: "2026-12-01", time: "19:00", status: "review" as const },
    { id: "c", date: "2026-12-08", time: "08:00", status: "review" as const },
    { id: "d", date: "2026-12-01", time: "08:00", status: "review" as const, locale: "en" as const },
    { id: "e", date: "2026-12-01", time: "07:30", status: "review" as const, kind: "reel" as const },
  ];
  assert.deepEqual([...keptCarouselIds(posts)].sort(), ["a", "c", "d"]);
});

test("parked carousels are never posted or kept, but stay available as source", async () => {
  const { isDue, shouldAutoApprove } = await import("../lib/contentCalendar/planning.ts");
  const base = { date: "2026-12-01", time: "08:00", status: "approved" as const, publish: undefined };
  assert.equal(isDue(base, "2026-12-01 09:00", { maxAttempts: 3, retryAfterMs: 0 }), true);
  assert.equal(isDue({ ...base, parked: "reels eerst" }, "2026-12-01 09:00", { maxAttempts: 3, retryAfterMs: 0 }), false);
  const review = { ...base, status: "review" as const, kind: "carousel" as const, image: { status: "ready" } as never, reel: undefined, video: undefined };
  assert.equal(shouldAutoApprove(review, "2026-12-01 09:00"), true);
  assert.equal(shouldAutoApprove({ ...review, parked: "reels eerst" }, "2026-12-01 09:00"), false);
  const posts = [
    { id: "a", date: "2026-11-30", time: "08:00", kind: "carousel" as const, status: "approved" as const, parked: "x" },
    { id: "b", date: "2026-12-02", time: "19:00", kind: "carousel" as const, status: "approved" as const },
  ];
  assert.deepEqual([...keptCarouselIds(posts)], ["b"]);
});

test("rejected reels free up their slot", () => {
  const existing = [{ date: "2026-12-01", time: "12:30", kind: "reel" as const, status: "rejected" as const }, { date: "2026-12-01", time: "20:00", kind: "reel" as const, status: "approved" as const }];
  assert.deepEqual(reelSlots("nl", "2026-12-01", 1, existing).map((s) => s.time), ["12:30"]);
});
