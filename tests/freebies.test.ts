import assert from "node:assert/strict";
import test from "node:test";

import { FREEBIES, parseLead } from "../lib/marketing/freebies/catalog.ts";
import { REPLY_BANK, REPLY_PREVIEW_IDS } from "../lib/marketing/freebies/replyBank.ts";

test("de antwoordenbank heeft 30 antwoorden in beide talen, met dezelfde ids", () => {
  assert.equal(REPLY_BANK.nl.replies.length, 30);
  assert.deepEqual(REPLY_BANK.en.replies.map((reply) => reply.id), REPLY_BANK.nl.replies.map((reply) => reply.id));
  assert.equal(new Set(REPLY_BANK.nl.replies.map((reply) => reply.id)).size, 30);
  for (const lang of ["nl", "en"] as const) {
    const categories = new Set(REPLY_BANK[lang].categories.map((category) => category.id));
    for (const reply of REPLY_BANK[lang].replies) {
      assert.ok(categories.has(reply.category), `${lang}/${reply.id}: onbekende categorie`);
      assert.ok(reply.title && reply.subject && reply.body && reply.tip, `${lang}/${reply.id}: leeg veld`);
      assert.doesNotMatch(`${reply.subject}${reply.body}${reply.tip}`, /—/, `${lang}/${reply.id}: geen lange streep`);
    }
  }
  for (const id of REPLY_PREVIEW_IDS) assert.ok(REPLY_BANK.nl.replies.some((reply) => reply.id === id));
});

test("elk keyword is uniek en in hoofdletters", () => {
  const keywords = FREEBIES.map((freebie) => freebie.keyword);
  assert.equal(new Set(keywords).size, keywords.length);
  for (const keyword of keywords) assert.match(keyword, /^[A-Z]+$/);
});

test("de e-mailgate accepteert alleen live downloads en geldige adressen", () => {
  assert.deepEqual(parseLead({ freebie: "antwoord", email: "nope" }), { error: "Vul een geldig e-mailadres in." });
  assert.deepEqual(parseLead({ freebie: "lek", email: "a@b.nl" }), { error: "Deze download bestaat niet." });
  assert.deepEqual(parseLead({ freebie: "bestaat-niet", email: "a@b.nl", lang: "en" }), { error: "This download doesn't exist." });
  const ok = parseLead({ freebie: "antwoord", email: " Jan@Shop.NL ", name: "Jan\n", marketing: "true", source: "utm_source=instagram" });
  assert.ok("lead" in ok);
  assert.equal(ok.lead.email, "jan@shop.nl");
  assert.equal(ok.lead.name, "Jan");
  // Alleen een echte true telt als toestemming voor tips.
  assert.equal(ok.lead.marketing, false);
  assert.equal(ok.lead.lang, "nl");
});
