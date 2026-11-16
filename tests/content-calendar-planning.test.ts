import assert from "node:assert/strict";
import test from "node:test";

import { amsterdamNow, assignFormats, assignPillars, buildSlots, isDue, shouldAutoApprove, slotKey, takenSlots } from "../lib/contentCalendar/planning.ts";

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

test("assignFormats varies the format and skips news formats without facts", () => {
  const formats = assignFormats(30, [], true);
  for (let i = 1; i < formats.length; i++) assert.notEqual(formats[i], formats[i - 1]);
  assert.ok(new Set(formats).size >= 8);
  assert.ok(formats.filter((f) => f === "tips").length <= 30 / 4);
  const withoutFacts = assignFormats(30, [], false);
  assert.ok(!withoutFacts.includes("regels") && !withoutFacts.includes("platform"));
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

test("takenSlots: twee posts op één dag kan, reels blokkeren de carrouselplanning niet", () => {
  const taken = takenSlots([
    { date: "2026-11-17", time: "08:00" },
    { date: "2026-11-17", time: "12:30", kind: "reel" },
    { date: "2026-11-17", time: "13:30", kind: "story" },
  ]);
  assert.equal(taken.has(slotKey({ date: "2026-11-17", time: "08:00" })), true);
  assert.equal(taken.has(slotKey({ date: "2026-11-17", time: "19:00" })), false);
  assert.equal(taken.has(slotKey({ date: "2026-11-17", time: "12:30" })), false);
});

test("shouldAutoApprove: alleen carrousels op beoordelen met klare foto, op of na hun moment", () => {
  const base = { status: "review" as const, date: "2026-11-17", time: "08:00", image: { status: "ready" as const, files: ["a.jpg"], selected: 0 } };
  assert.equal(shouldAutoApprove(base, "2026-11-17 08:00"), true);
  assert.equal(shouldAutoApprove(base, "2026-11-17 07:55"), false);
  assert.equal(shouldAutoApprove({ ...base, image: { ...base.image, status: "generating" as const } }, "2026-11-17 09:00"), false);
  assert.equal(shouldAutoApprove({ ...base, status: "rejected" as const }, "2026-11-17 09:00"), false);
  assert.equal(shouldAutoApprove({ ...base, kind: "reel" as const }, "2026-11-17 09:00"), false);
});

test("isTooSimilar catches repeated and near-identical headlines, not new topics", async () => {
  const { isTooSimilar } = await import("../lib/contentCalendar/planning.ts");
  const existing = ["5 cijfers die je elke week moet zien", "Schrijf een SOP in 15 minuten", "Wat kost één retour je echt?"];
  assert.equal(isTooSimilar("5 cijfers die je elke week moet zien", existing), true);
  assert.equal(isTooSimilar("De 5 cijfers die je elke week wilt zien", existing), true);
  assert.equal(isTooSimilar("Schrijf je SOP in een kwartier: 15 minuten", existing), true);
  assert.equal(isTooSimilar("Mythe: gratis verzending verhoogt altijd je winst", existing), false);
  assert.equal(isTooSimilar("Wat levert 1% hogere conversie je op?", existing), false);
  assert.equal(isTooSimilar("Mythe: meer verkoopkanalen = meer winst", ["Mythe: gratis verzending verhoogt altijd je winst"]), false);
  assert.equal(isTooSimilar("Sinds juni verplicht: de herroepingsknop in je shop", ["Herroepingsknop verplicht: zo richt je het in"]), true);
});

test("factUsedIn recognises a news fact by whole words only", async () => {
  const { NEWS, factUsedIn } = await import("../lib/contentCalendar/brand.ts");
  const fact = (id: string) => NEWS.find((n) => n.id === id)!;
  assert.equal(factUsedIn(fact("oss"), [{ headline: "Verkoop je naar België of Duitsland? Let op €10.000" }]), true);
  assert.equal(factUsedIn(fact("oss"), [{ headline: "Vraag om de oplossing, niet om de vraag" }]), false);
  assert.equal(factUsedIn(fact("groene-claims"), [{ headline: "Stelling: je kunt 8 uur per dag diep geconcentreerd werken" }]), false);
  assert.equal(factUsedIn(fact("platform-updates"), [{ headline: "Zet je overleggen om in een asynchrone statusupdate" }]), false);
  assert.equal(factUsedIn(fact("reviews"), [{ headline: "De wekelijkse review van 30 minuten" }]), false);
  assert.equal(factUsedIn(fact("herroepingsknop"), [{ headline: "Herroepingsknop inrichten: zo voldoe je aan de regels", factId: undefined }]), true);
});
