import assert from "node:assert/strict";
import test from "node:test";

import { shouldSendBriefing, unsubscribeSignature, validUnsubscribeSignature, weekKey, weeklyBriefingEmail } from "../lib/support/weeklyBriefing.ts";

const base = {
  nl: true, shopName: "Speelgoedwinkel",
  stats: { questions: 31, replies: 24, autonomous: 9, hours: 2, euros: 50, waiting: 3 },
  painPoints: [{ category: "Wieltjes ontbreken", count: 14, recommended_action: "Controleer de dozen." }],
  commerce: [], appUrl: "https://support.sequenceflow.io", unsubscribeUrl: "https://support.sequenceflow.io/api/briefing/unsubscribe?t=x&s=y",
};

test("the weekly email says what happened, what waits and where customers get stuck", () => {
  const { subject, text } = weeklyBriefingEmail(base);
  assert.match(subject, /24 antwoorden/);
  assert.match(text, /31 klantvragen binnen, 24 antwoorden verstuurd \(waarvan 9 zelfstandig\)/);
  assert.match(text, /Wacht op jou: 3 gesprekken/);
  assert.match(text, /1\. Wieltjes ontbreken \(14 vragen\)/);
  assert.match(text, /Afmelden: https/);
  assert.doesNotMatch(text, /bol\.com/);
});

test("no email in a quiet week; one key per week", () => {
  assert.equal(shouldSendBriefing({ questions: 0, replies: 0, autonomous: 0, hours: 0, euros: 0, waiting: 0 }), false);
  assert.equal(shouldSendBriefing({ ...base.stats }), true);
  assert.equal(weekKey(new Date("2026-11-09T06:00:00Z")), "2026-11-09");
  assert.equal(weekKey(new Date("2026-11-15T23:00:00Z")), "2026-11-09");
});

test("the unsubscribe link only works for its own workspace", () => {
  const sig = unsubscribeSignature("tenant-a", "secret");
  assert.equal(validUnsubscribeSignature("tenant-a", sig, "secret"), true);
  assert.equal(validUnsubscribeSignature("tenant-b", sig, "secret"), false);
  assert.equal(validUnsubscribeSignature("tenant-a", "short", "secret"), false);
});
