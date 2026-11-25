import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { FREEBIES, parseLead } from "../lib/marketing/freebies/catalog.ts";

test("elk keyword is uniek en in hoofdletters", () => {
  const keywords = FREEBIES.map((freebie) => freebie.keyword);
  assert.equal(new Set(keywords).size, keywords.length);
  for (const keyword of keywords) assert.match(keyword, /^[A-Z]+$/);
});

test("de e-mailgate accepteert alleen live downloads en geldige adressen", () => {
  assert.deepEqual(parseLead({ freebie: "academy", email: "nope" }), { error: "Vul een geldig e-mailadres in." });
  assert.deepEqual(parseLead({ freebie: "lek", email: "a@b.nl" }), { error: "Deze download bestaat niet." });
  assert.deepEqual(parseLead({ freebie: "bestaat-niet", email: "a@b.nl", lang: "en" }), { error: "This download doesn't exist." });
  const ok = parseLead({ freebie: "academy", email: " Jan@Shop.NL ", name: "Jan\n", marketing: "true", source: "utm_source=instagram" });
  assert.ok("lead" in ok);
  assert.equal(ok.lead.email, "jan@shop.nl");
  assert.equal(ok.lead.name, "Jan");
  // Alleen een echte true telt als toestemming voor tips.
  assert.equal(ok.lead.marketing, false);
  assert.equal(ok.lead.lang, "nl");
});

test("de Academy: elke les heeft NL en EN, unieke ids en een status per taal", async () => {
  const { ACADEMY, academyStats } = await import("../lib/marketing/academy/catalog.ts");
  const ids = new Set<string>();
  for (const category of ACADEMY) {
    assert.ok(category.nl.title && category.en.title, category.id);
    for (const lesson of category.lessons) {
      assert.ok(!ids.has(`${category.id}/${lesson.id}`), lesson.id);
      ids.add(`${category.id}/${lesson.id}`);
      assert.ok(lesson.nl.title && lesson.en.title && lesson.minutes > 0, lesson.id);
      for (const lang of ["nl", "en"] as const) {
        assert.ok(["planned", "ready"].includes(lesson.status[lang]), lesson.id);
        // Klaar zonder video kan niet.
        if (lesson.status[lang] === "ready") assert.ok(lesson.video?.[lang], `${lesson.id} ${lang}: klaar maar geen video`);
      }
    }
  }
  assert.equal(academyStats().lessons, ids.size);
});

test("de oude /gratis- en /free-links sturen door naar de Academy", () => {
  const config = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
  for (const [from, to] of [["/nl/gratis", "/nl/academy"], ["/nl/gratis/antwoordenbank", "/nl/academy"], ["/en/free", "/en/academy"], ["/en/free/reply-bank", "/en/academy"], ["/nl/academy/antwoordenbank", "/nl/academy"], ["/en/academy/reply-bank", "/en/academy"]]) {
    assert.match(config, new RegExp(`source: "${from}", destination: "${to}", permanent: true`));
  }
});

test("Academy-video's komen van de mediaserver, of uit een eigen map", async () => {
  const { academyMedia } = await import("../lib/marketing/academy/catalog.ts");
  assert.equal(academyMedia("/academy/les1.mp4", ""), "https://media.sequenceflow.io/a/les1.mp4");
  assert.equal(academyMedia("/academy/les1.mp4", "/academy"), "/academy/les1.mp4");
  assert.equal(academyMedia(undefined), undefined);
});

test("Academy-code: alleen de juiste code binnen 15 minuten opent de aanmelding", async () => {
  const { newLeadCode, pendingLeadToken, readPendingLead } = await import("../lib/marketing/leadsCore.ts");
  const secret = "x".repeat(40);
  const code = newLeadCode(() => 0.5);
  assert.equal(code, "550000");
  assert.match(newLeadCode(), /^\d{6}$/);
  const lead = { f: "academy", e: "jan@shop.nl", n: "Jan", s: "", m: true, l: "nl" as const, src: "utm_source=instagram" };
  const now = 1_000_000;
  const token = pendingLeadToken(secret, lead, code, now);
  assert.deepEqual(readPendingLead(secret, token, "550 000", now + 60_000), { lead });
  assert.deepEqual(readPendingLead(secret, token, "550001", now), { error: "wrong" });
  assert.deepEqual(readPendingLead(secret, token, code, now + 16 * 60_000), { error: "expired" });
  assert.deepEqual(readPendingLead("y".repeat(40), token, code, now), { error: "wrong" });
  // Ander e-mailadres in het token zetten breekt de handtekening.
  const [body, mac] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), e: "boef@x.nl" })).toString("base64url");
  assert.deepEqual(readPendingLead(secret, `${forged}.${mac}`, code, now), { error: "wrong" });
  assert.deepEqual(readPendingLead(secret, "rommel", code, now), { error: "invalid" });
});
