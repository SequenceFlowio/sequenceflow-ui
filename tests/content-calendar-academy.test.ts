import assert from "node:assert/strict";
import test from "node:test";

import { ACADEMY_CTA, withAcademyCta } from "../lib/contentCalendar/academyCta.ts";
import { tiktokText } from "../lib/contentCalendar/tiktokFormat.ts";

test("old calls to action make way for the Academy CTA", () => {
  const story = "Om vijf uur klaar. Op tijd aan tafel. 🍝\n\nSeffy zet bij elke klantmail een antwoord klaar, jij keurt goed. Support One: 14 dagen gratis, link in bio.";
  assert.equal(withAcademyCta(story, "nl"), `Om vijf uur klaar. Op tijd aan tafel. 🍝\n\nSeffy zet bij elke klantmail een antwoord klaar, jij keurt goed.\n\n${ACADEMY_CTA.nl}`);
  assert.equal(withAcademyCta("Black Friday komt eraan.\n\nDoe jij mee dit jaar? Laat het weten in de comments.", "nl"), `Black Friday komt eraan.\n\n${ACADEMY_CTA.nl}`);
  assert.equal(withAcademyCta("Plan your week.\n\nSave this post and share it with a founder friend.", "en"), `Plan your week.\n\n${ACADEMY_CTA.en}`);
  assert.equal(withAcademyCta("Eén alinea met een tip. Bewaar deze post voor later.", "nl"), `Eén alinea met een tip.\n\n${ACADEMY_CTA.nl}`);
});

test("the Academy CTA is added once and keeps the hook", () => {
  const once = withAcademyCta("Hook zonder oproep.", "en");
  assert.equal(once, `Hook zonder oproep.\n\n${ACADEMY_CTA.en}`);
  assert.equal(withAcademyCta(once, "en"), once);
  assert.equal(withAcademyCta("", "nl"), ACADEMY_CTA.nl);
});

test("TikTok leaves out the Instagram-only Academy CTA", () => {
  const caption = withAcademyCta("Hook.\n\nNog een zin.", "nl");
  assert.equal(tiktokText({ headline: "Kop", caption }).videoTitle, "Hook.\n\nNog een zin.");
});
