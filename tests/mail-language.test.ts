import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { authMailKind, authMailLanguage, verifyStandardWebhook } from "../lib/auth/sendEmailHookCore.ts";
import { leadNurtureEmail } from "../lib/email/leadTemplates.ts";
import { mailPreviews } from "../lib/email/previews.ts";
import { dueNurtureStep, leadToken, readLeadToken } from "../lib/marketing/leadsCore.ts";

const DUTCH = /\b(Hoi|Groet|je bestelling|jouw|bekijken|Afmelden|aangemeld|uitnodiging|wachtwoord|inlogcode)\b/i;

test("elke mail aan klanten, affiliates en downloaders bestaat in het Nederlands én Engels", () => {
  const previews = mailPreviews();
  const external = previews.filter((preview) => preview.group !== "Intern");
  for (const key of new Set(external.map((preview) => preview.key))) {
    const langs = external.filter((preview) => preview.key === key).map((preview) => preview.language).sort();
    assert.deepEqual(langs, ["en", "nl"], key);
  }
  for (const preview of external) {
    assert.match(preview.html, new RegExp(`<html lang="${preview.language}"`), `${preview.key} ${preview.language}`);
    assert.ok(preview.languageSource, preview.key);
  }
  // Intern blijft Nederlands.
  assert.ok(previews.filter((preview) => preview.group === "Intern").every((preview) => preview.language === "nl"));
});

test("Engelse mails bevatten geen Nederlands", () => {
  for (const preview of mailPreviews().filter((p) => p.language === "en")) {
    const text = preview.html.replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+/g, " ");
    assert.doesNotMatch(`${preview.subject} ${text}`, DUTCH, `${preview.key}: ${(`${preview.subject} ${text}`.match(DUTCH) ?? [])[0]}`);
  }
});

test("de Send Email Hook accepteert alleen een geldige handtekening van Supabase", () => {
  const key = Buffer.from("geheim-voor-de-test-1234567890");
  const secret = `v1,whsec_${key.toString("base64")}`;
  const body = JSON.stringify({ user: { email: "a@b.nl" } });
  const now = Date.parse("2026-11-23T10:00:00Z");
  const ts = String(Math.floor(now / 1000));
  const signature = `v1,${createHmac("sha256", key).update(`msg_1.${ts}.${body}`).digest("base64")}`;
  assert.equal(verifyStandardWebhook({ secret, id: "msg_1", timestamp: ts, signature, body, now }), true);
  assert.equal(verifyStandardWebhook({ secret, id: "msg_1", timestamp: ts, signature, body: `${body} `, now }), false, "andere inhoud");
  assert.equal(verifyStandardWebhook({ secret, id: "msg_1", timestamp: ts, signature, body, now: now + 10 * 60_000 }), false, "te oud");
  assert.equal(verifyStandardWebhook({ secret, id: "msg_1", timestamp: ts, signature: "v1,xxx", body, now }), false);
});

test("soort en taal van de auth-mail", () => {
  assert.equal(authMailKind("magiclink"), "login");
  assert.equal(authMailKind("signup"), "login");
  assert.equal(authMailKind("invite"), "invite");
  assert.equal(authMailKind("iets-anders"), null);
  assert.equal(authMailLanguage({ redirectTo: "https://support.sequenceflow.io/auth/callback?next=%2Fdashboard&lang=en" }), "en");
  assert.equal(authMailLanguage({ redirectTo: "https://support.sequenceflow.io/auth/callback", userLang: "en" }), "en");
  assert.equal(authMailLanguage({ redirectTo: null, workspaceLang: "en" }), "en");
  assert.equal(authMailLanguage({}), "nl");
});

test("afmeld- en downloadlinks zijn ondertekend en niet uitwisselbaar", () => {
  const id = "0b9f3c2e-1d4a-4c7b-9e2f-123456789abc";
  const unsubscribe = leadToken("s", "unsubscribe", id);
  assert.equal(readLeadToken("s", "unsubscribe", unsubscribe), id);
  assert.equal(readLeadToken("s", "unlock", unsubscribe), null, "afmeldtoken opent geen download");
  assert.equal(readLeadToken("ander", "unsubscribe", unsubscribe), null);
  assert.equal(readLeadToken("s", "unsubscribe", "niet-een-token"), null);
});

test("de reeks: één mail per keer, op dag 2, 5 en 9", () => {
  const created = "2026-11-01T09:00:00Z";
  const at = (days: number) => Date.parse(created) + days * 86_400_000;
  assert.equal(dueNurtureStep({ nurture_step: 0, created_at: created, nurture_sent_at: null }, at(1)), null);
  assert.equal(dueNurtureStep({ nurture_step: 0, created_at: created, nurture_sent_at: null }, at(2)), 1);
  // Lang stilgelegen: nog steeds maar de eerstvolgende, niet alles tegelijk.
  assert.equal(dueNurtureStep({ nurture_step: 0, created_at: created, nurture_sent_at: null }, at(20)), 1);
  assert.equal(dueNurtureStep({ nurture_step: 1, created_at: created, nurture_sent_at: new Date(at(20)).toISOString() }, at(20.5)), null, "36 uur ertussen");
  assert.equal(dueNurtureStep({ nurture_step: 3, created_at: created, nurture_sent_at: null }, at(30)), null, "reeks klaar");
});

test("elke tip-mail heeft een afmeldlink, in tekst en HTML", () => {
  for (const language of ["nl", "en"] as const) for (const step of [1, 2, 3]) {
    const mail = leadNurtureEmail({ step, language, unsubscribeUrl: "https://www.sequenceflow.io/api/marketing/unsubscribe?l=x" });
    assert.match(mail.text, /api\/marketing\/unsubscribe\?l=x/);
    assert.match(mail.html, /api\/marketing\/unsubscribe\?l=x/);
  }
});
