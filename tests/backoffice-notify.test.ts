import assert from "node:assert/strict";
import test from "node:test";

import { noticeEmail, noticeRecipients, scheduledCancel } from "../lib/backoffice/notifyCore.ts";
import { estimateCredit, sumCostsResponse } from "../lib/backoffice/openaiCreditCore.ts";

test("meldingen gaan naar de aparte lijst, anders naar de beheerders", () => {
  assert.deepEqual(noticeRecipients({ PLATFORM_ADMIN_EMAILS: "A@x.nl, b@x.nl,", BACKOFFICE_NOTIFY_EMAILS: "" }), ["a@x.nl", "b@x.nl"]);
  assert.deepEqual(noticeRecipients({ PLATFORM_ADMIN_EMAILS: "a@x.nl", BACKOFFICE_NOTIFY_EMAILS: "c@x.nl" }), ["c@x.nl"]);
  assert.deepEqual(noticeRecipients({}), []);
});

test("een melding heeft onderwerp, tekst en HTML", () => {
  const mail = noticeEmail({ kind: "paid", ref: "x", workspace: "Studio <Lume>", plan: "Growth", amount: "€177,87" }, "https://www.sequenceflow.io/backoffice");
  assert.equal(mail.subject, "Betaald: Studio <Lume> · Growth · €177,87");
  assert.match(mail.text, /Pakket: Growth/);
  assert.match(mail.html, /Studio &lt;Lume&gt;/);
  assert.match(mail.html, /tab=klanten/);
});

test("alleen een nieuwe opzegging telt", () => {
  // net opgezegd
  assert.deepEqual(scheduledCancel({ cancel_at_period_end: true, cancel_at: 1_800_000_000 }, { cancel_at_period_end: false, cancel_at: null }), { endsAt: new Date(1_800_000_000 * 1000).toISOString() });
  // al opgezegd, iets anders veranderde
  assert.equal(scheduledCancel({ cancel_at_period_end: true, cancel_at: 1_800_000_000 }, { items: {} }), null);
  // opzegging teruggedraaid
  assert.equal(scheduledCancel({ cancel_at_period_end: false, cancel_at: null }, { cancel_at_period_end: true }), null);
  assert.equal(scheduledCancel({ cancel_at_period_end: true }, null), null);
});

test("OpenAI-tegoed: stand min verbruik, met waarschuwing", () => {
  const ok = estimateCredit({ balanceUsd: 100, notedAt: "2026-11-10T10:00:00Z", spentSinceUsd: 20, last7DaysUsd: 14, basis: "estimate" });
  assert.equal(ok.remainingUsd, 80);
  assert.equal(ok.perDayUsd, 2);
  assert.equal(ok.daysLeft, 40);
  assert.equal(ok.level, "ok");
  assert.equal(estimateCredit({ balanceUsd: 30, notedAt: "x", spentSinceUsd: 15, last7DaysUsd: 14, basis: "estimate" }).level, "low");
  assert.equal(estimateCredit({ balanceUsd: 100, notedAt: "x", spentSinceUsd: 40, last7DaysUsd: 70, basis: "estimate" }).level, "low");
  assert.equal(estimateCredit({ balanceUsd: 10, notedAt: "x", spentSinceUsd: 12, last7DaysUsd: 7, basis: "estimate" }).level, "empty");
  assert.equal(estimateCredit({ balanceUsd: 10, notedAt: "x", spentSinceUsd: 0, last7DaysUsd: 0, basis: "estimate" }).daysLeft, null);
});

test("kosten uit OpenAI's kostenoverzicht optellen", () => {
  const body = { data: [
    { results: [{ amount: { value: 1.25, currency: "usd" } }, { amount: { value: 0.5, currency: "usd" } }] },
    { results: [{ amount: { value: 2, currency: "usd" } }, { amount: { value: 9, currency: "eur" } }] },
    { results: [] },
  ] };
  assert.equal(sumCostsResponse(body), 3.75);
  assert.equal(sumCostsResponse(null), 0);
});
