import test from "node:test";
import assert from "node:assert/strict";

import { HOOKS, cleanInvisible, findSlop, pickHook, reviewCaption, shortenCaption } from "../lib/contentCalendar/copy.ts";

test("hook formulas rotate per template and skip the last eight", () => {
  const recent: number[] = [];
  for (let i = 0; i < 8; i++) recent.push(pickHook("tips", recent).id);
  assert.equal(new Set(recent).size, 8);
  assert.ok(recent.every((id) => HOOKS.find((h) => h.id === id)!.for.includes("tips")));
  // goed scorende formule komt vaker terug
  const boosted = pickHook("aware", [16, 16], { 16: 1.8, 5: 0.6, 12: 0.6, 13: 0.6, 18: 0.6, 24: 0.6, 14: 0.6, 10: 0.6, 21: 0.6 });
  assert.ok(boosted.for.includes("aware"));
});

test("AI-sounding words are caught in both languages", () => {
  assert.match(findSlop("Let's delve into your returns.", "en") ?? "", /delve/);
  assert.match(findSlop("It's not just a tool, it's a teammate.", "en") ?? "", /zinsbouw/);
  assert.equal(findSlop("Answer the email before lunch. Save this for Friday.", "en"), null);
  assert.match(findSlop("Een naadloze ervaring voor je klant.", "nl") ?? "", /naadloze/);
  assert.equal(findSlop("Volg SequenceFlow voor dagelijkse inzichten om je bedrijf te verbeteren.", "nl"), null);
  assert.equal(findSlop("Follow SequenceFlow for daily insights to grow your business.", "en"), null);
  assert.equal(cleanInvisible("a​b⁠c"), "abc");
});

test("captions are short, hook first, without hashtags", () => {
  assert.equal(reviewCaption("Drie retourregels die je vandaag nog aanpast.\n\nBewaar deze voor je volgende actie."), null);
  assert.match(reviewCaption("Kort.\n\n#webshop #ondernemen") ?? "", /hashtags/);
  assert.match(reviewCaption("x".repeat(320)) ?? "", /te lang/);
  const long = "Klanten die na het bestellen vragen om een latere bezorgdag kosten vaak onnodig veel uitzoekwerk. Je moet controleren of het pakket al is ingepakt en zelf een bericht tikken.\n\nSupport One leest de mail en zet een concept klaar. Jij keurt het alleen nog goed.\n\nSla deze reel op voor drukke dagen.\n\n#webshop #sequenceflow";
  const short = shortenCaption(long);
  assert.equal(reviewCaption(short), null);
  assert.ok(short.startsWith("Klanten die na het bestellen"));
  assert.ok(short.endsWith("Sla deze reel op voor drukke dagen."));
});
