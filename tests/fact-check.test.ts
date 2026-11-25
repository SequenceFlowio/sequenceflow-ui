import assert from "node:assert/strict";
import test from "node:test";

import { checkDraftFacts, describeFactIssues, type FactCheckOrder } from "../lib/commerce/factCheck.ts";

const order: FactCheckOrder = {
  displayName: "#1042",
  totalAmount: 27.5,
  orderCreatedAt: "2026-11-16T10:00:00Z",
  items: [{ unitPrice: 13.75, latestDeliveryAt: null }],
  fulfillments: [{ trackingNumber: "3SZZP1042NL", trackingUrl: "https://jouw.postnl.nl/track-and-trace/3SZZP1042NL", shipmentDate: "2026-11-17T09:00:00Z" }],
};
const sourceText = "Retourkosten 4,95 euro. Gratis verzending vanaf €35. Kijk op https://www.postnl.nl/tracktrace voor je zending.";
const customerText = "Waar blijft bestelling #1042? Ik heb op 16 november besteld.";

test("feitencheck: alles uit de bronnen is goed", () => {
  const draft = "Je bestelling #1042 (€27,50) is op 17-11 verzonden met PostNL, code 3SZZP1042NL: https://jouw.postnl.nl/track-and-trace/3SZZP1042NL. Retour kost 4,95 euro; gratis verzending vanaf €35. Je bestelde op 16 november.";
  assert.deepEqual(checkDraftFacts({ draft, customerText, sourceText, order }), []);
});

test("feitencheck: verzonnen bestelnummer, code, link, bedrag, datum en belofte worden gevonden", () => {
  const draft = "Bestelling #1099 is onderweg met code 3SXX9999999NL (https://jouw.postnl.nl/track-and-trace/3SXX9999999NL). Je krijgt €5,00 terug en hij komt morgen aan, uiterlijk 28 november.";
  const issues = checkDraftFacts({ draft, customerText, sourceText, order });
  assert.deepEqual(issues.map((i) => i.kind).sort(), ["amount", "date", "order", "promise", "tracking", "url"]);
  assert.match(describeFactIssues(issues), /bestelnummer niet in de bronnen: #1099/);
});

test("feitencheck: zonder bestelling mag alleen wat de klant of de kennisbank noemt", () => {
  assert.deepEqual(checkDraftFacts({ draft: "Bestelling #1042 zoeken we voor je op.", customerText, sourceText, order: null }), []);
  assert.deepEqual(checkDraftFacts({ draft: "Hij wordt vandaag nog bezorgd.", customerText, sourceText, order: null }).map((i) => i.kind), ["promise"]);
});

test("feitencheck: een leverdatum in de bestelling maakt een belofte niet verzonnen", () => {
  const withDate = { ...order, items: [{ unitPrice: 13.75, latestDeliveryAt: "2026-11-24T18:00:00Z" }] };
  assert.deepEqual(checkDraftFacts({ draft: "Je pakket wordt morgen bezorgd, uiterlijk 24 november.", customerText, sourceText, order: withDate }), []);
});

test("feitencheck: Engelse datum en bol-bestelnummer", () => {
  const bol: FactCheckOrder = { displayName: "A1B2C3D4E5", totalAmount: 64, items: [], fulfillments: [{ trackingNumber: "JVGL0099887766" }] };
  assert.deepEqual(checkDraftFacts({ draft: "Order A1B2C3D4E5 is on its way, tracking JVGL0099887766.", customerText: "", sourceText: "", order: bol }), []);
  assert.deepEqual(checkDraftFacts({ draft: "It will arrive on 3 december.", customerText: "", sourceText: "", order: bol }).map((i) => i.kind), ["date"]);
});
