import assert from "node:assert/strict";
import test from "node:test";

import { delayMessage, findDelays, type DelayOrder } from "../lib/commerce/delays.ts";

const now = new Date("2026-11-10T12:00:00Z");
const order = (patch: Partial<DelayOrder>): DelayOrder => ({ id: "o", displayName: "#1001", provider: "bol", orderCreatedAt: "2026-11-09T10:00:00Z", cancelledAt: null, promisedBy: null, shippedAt: null, lastTrackingAt: null, transportCode: null, trackingUrl: null, ...patch });

test("a passed delivery promise without delivery is a delay", () => {
  const [delay] = findDelays([order({ promisedBy: "2026-11-08T22:00:00Z", shippedAt: "2026-11-07T10:00:00Z" })], now);
  assert.equal(delay.reason, "past_promise");
  assert.equal(delay.days, 1);
});

test("delivered, cancelled or fresh orders are not delays", () => {
  assert.equal(findDelays([order({ promisedBy: "2026-11-08T22:00:00Z", transportCode: "DELIVERED_AT_CUSTOMER" })], now).length, 0);
  assert.equal(findDelays([order({ promisedBy: "2026-11-08T22:00:00Z", cancelledAt: "2026-11-08T10:00:00Z" })], now).length, 0);
  assert.equal(findDelays([order({})], now).length, 0);
  // Verzonden zonder enige trackingupdate: geen signaal (we weten het niet).
  assert.equal(findDelays([order({ shippedAt: "2026-11-01T10:00:00Z" })], now).length, 0);
});

test("stalled tracking and unshipped orders are flagged, worst first", () => {
  const delays = findDelays([
    order({ id: "a", orderCreatedAt: "2026-11-06T10:00:00Z" }),
    order({ id: "b", shippedAt: "2026-11-05T10:00:00Z", lastTrackingAt: "2026-11-06T10:00:00Z" }),
    order({ id: "c", promisedBy: "2026-11-09T10:00:00Z" }),
  ], now);
  assert.deepEqual(delays.map((d) => [d.order.id, d.reason]), [["c", "past_promise"], ["b", "tracking_stalled"], ["a", "not_shipped"]]);
});

test("the suggested message is friendly and mentions tracking when known", () => {
  const [delay] = findDelays([order({ promisedBy: "2026-11-08T22:00:00Z", trackingUrl: "https://track.example/1" })], now);
  assert.match(delayMessage(delay), /^Hoi, even een update over je bestelling #1001/);
  assert.match(delayMessage(delay), /track\.example/);
});
