import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSilence, type SilenceSnapshot } from "../lib/ops/silenceCore.ts";

const now = new Date("2026-11-23T10:00:00Z");
const healthy: SilenceSnapshot = {
  lastApprovedPostDate: "2026-12-31", overduePosts: 0, postedRecent: 10, postedRecentWithMetrics: 6,
  failingMailboxes: [], connectedActiveTenants: 2, lastInboundAt: "2026-11-23T08:00:00Z", stuckAutosend: 0,
};

test("stilte: alles gezond geeft geen melding", () => {
  assert.deepEqual(evaluateSilence(healthy, now), []);
});

test("stilte: elke uitblijvende stap geeft precies één melding met oorzaak", () => {
  const ids = evaluateSilence({
    ...healthy,
    lastApprovedPostDate: "2026-11-25",
    overduePosts: 2,
    postedRecentWithMetrics: 0,
    failingMailboxes: [{ tenantId: "t1", workspace: "Zeepzus", channel: "IMAP", error: "AUTHENTICATIONFAILED" }],
    lastInboundAt: "2026-11-19T08:00:00Z",
    stuckAutosend: 1,
  }, now).map((a) => a.id);
  assert.deepEqual(ids, ["content-buffer", "content-overdue", "content-metrics", "mailbox:t1:IMAP", "inbound-silent", "autosend-stuck"]);
});

test("stilte: geen mailmelding zonder actieve gekoppelde werkruimte, en geen cijfermelding bij weinig posts", () => {
  const alerts = evaluateSilence({ ...healthy, connectedActiveTenants: 0, lastInboundAt: null, postedRecent: 2, postedRecentWithMetrics: 0 }, now);
  assert.deepEqual(alerts, []);
});

test("stilte: de buffer telt in Amsterdamse datums", () => {
  assert.equal(evaluateSilence({ ...healthy, lastApprovedPostDate: "2026-11-27" }, now)[0]?.id, "content-buffer", "27 nov is minder dan 5 dagen na 23 nov");
  assert.deepEqual(evaluateSilence({ ...healthy, lastApprovedPostDate: "2026-11-28" }, now), [], "28 nov is precies 5 dagen na 23 nov");
  assert.deepEqual(evaluateSilence({ ...healthy, lastApprovedPostDate: "2026-11-27" }, new Date("2026-11-22T22:00:00Z")), [], "22 nov 23:00 in Amsterdam: 27 nov is 5 dagen later");
});

test("stilte: te late posts tellen in de tijdzone van de taal, geparkeerde posts niet", async () => {
  const { countOverduePosts } = await import("../lib/ops/silenceCore.ts");
  // 23 nov 22:17 in Amsterdam (21:17 UTC)
  const at = new Date("2026-11-23T21:17:00Z");
  const rows = [
    { date: "2026-11-23", time: "19:00", locale: "en" }, // 19:00 New York = 01:00 in Amsterdam: nog niet aan de beurt
    { date: "2026-11-23", time: "20:00", locale: "nl" }, // 20:00 Amsterdam: te laat
    { date: "2026-11-20", time: "19:00", locale: "nl", parked: true }, // geparkeerd: telt niet
    { date: "2026-11-23", time: "12:00", locale: "en" }, // 12:00 New York = 18:00 Amsterdam: te laat
  ];
  assert.equal(countOverduePosts(rows, at), 2);
  assert.equal(countOverduePosts([{ date: "2026-11-23", time: "19:00", locale: "en" }], new Date("2026-11-24T00:31:00Z")), 1, "19:00 New York + 31 minuten");
});
