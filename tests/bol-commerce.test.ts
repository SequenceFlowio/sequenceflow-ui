import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  bolTokenNeedsRefresh,
  decodeBolAccountId,
  normalizeBolOrder,
  normalizeBolReturnItem,
} from "../lib/commerce/bolCore.ts";
import {
  bolReplyAddress,
  extractBolOrderReferences,
  isRecognizedBolMail,
} from "../lib/commerce/bolMail.ts";
import { bolEventId, normalizeBolEvent, parseBolSignature, verifyBolSignature } from "../lib/commerce/bolWebhook.ts";

test("bol.com tokens refresh shortly before expiry and expose only the account id", () => {
  const now = Date.parse("2026-07-27T10:00:00.000Z");
  assert.equal(bolTokenNeedsRefresh(null, now), true);
  assert.equal(bolTokenNeedsRefresh("2026-07-27T10:00:20.000Z", now), true);
  assert.equal(bolTokenNeedsRefresh("2026-07-27T10:02:00.000Z", now), false);
  const payload = Buffer.from(JSON.stringify({ sub: "retailer-123", secret: "not-returned" })).toString("base64url");
  assert.equal(decodeBolAccountId(`header.${payload}.signature`), "retailer-123");
  assert.equal(decodeBolAccountId("invalid"), null);
});

test("bol.com orders normalize item, promise, shipment, and tracking context", () => {
  const order = normalizeBolOrder({
    orderId: "1234567890",
    orderPlacedDateTime: "2026-07-26T10:00:00Z",
    shipmentDetails: { email: "relay@example.invalid" },
    orderItems: [{
      orderItemId: "item-1",
      quantity: 2,
      quantityShipped: 1,
      unitPrice: 19.95,
      ean: "8712345678901",
      cancellationRequest: true,
      product: { title: "Kussen", ean: "8712345678901" },
      offer: { offerId: "offer-1", reference: "SKU-1" },
      fulfilment: {
        method: "FBR",
        distributionParty: "RETAILER",
        latestDeliveryDate: "2026-07-29T21:59:59Z",
      },
    }],
  }, [{
    shipmentId: "shipment-1",
    shipmentDateTime: "2026-07-27T08:00:00Z",
    transport: {
      transporterCode: "POSTNL",
      trackAndTrace: "3STEST",
      transportEvents: [
        { eventCode: "PICKED_UP", eventDateTime: "2026-07-27T09:00:00Z" },
        { eventCode: "DELIVERED", eventDescription: "Bezorgd", eventDateTime: "2026-07-27T12:00:00Z" },
      ],
    },
  }]);

  assert.equal(order.externalId, "1234567890");
  assert.equal(order.fulfillmentStatus, "PARTIALLY_SHIPPED");
  assert.equal(order.totalAmount, 39.9);
  assert.equal(order.cancelable, false);
  assert.equal(order.items[0].ean, "8712345678901");
  assert.equal(order.items[0].fulfilmentMethod, "FBR");
  assert.equal(order.items[0].cancellationRequested, true);
  assert.equal(order.fulfillments[0].trackingNumber, "3STEST");
  assert.equal(order.fulfillments[0].transportStatusCode, "DELIVERED");
});

test("bol.com returns sum processing results without storing customer comments", () => {
  assert.deepEqual(normalizeBolReturnItem({
    expectedQuantity: 3,
    handled: true,
    returnReason: { mainReason: "Defect", customerComments: "Contains personal details" },
    processingResults: [
      { quantity: 2, processingResult: "ACCEPTED" },
      { quantity: 1, processingResult: "REJECTED" },
    ],
  }), {
    expectedQuantity: 3,
    handledQuantity: 3,
    handled: true,
    handlingResult: "ACCEPTED, REJECTED",
    reason: "Defect",
  });
});

test("bol.com mail recognition requires both a trusted sender and a template marker", () => {
  const recognized = {
    from: "klantvragen@mail.bol.com",
    replyTo: "reply+thread@mail.bol.com",
    subject: "Nieuwe bol.com klantvraag over bestelling 1234567890",
  };
  assert.equal(isRecognizedBolMail(recognized), true);
  assert.deepEqual(extractBolOrderReferences(recognized.subject, "Referentie 1234567890"), ["1234567890"]);
  assert.equal(bolReplyAddress(recognized.from, recognized.replyTo), recognized.replyTo);
  assert.equal(isRecognizedBolMail({ ...recognized, from: "attacker@example.com", replyTo: null }), false);
  assert.equal(isRecognizedBolMail({ ...recognized, subject: "Gewone nieuwsbrief" }), false);
});

test("bol.com webhook signatures are parsed and verified with RSA-SHA256", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const body = JSON.stringify({ eventId: "event-1", resource: "ORDER", resourceId: "1234567890" });
  const signature = crypto.sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64");
  const header = `keyId=key-1, algorithm="rsa-sha256", signature="${signature}"`;
  const publicDer = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  assert.deepEqual(parseBolSignature(header)?.keyId, "key-1");
  assert.equal(verifyBolSignature(body, header, publicDer), true);
  assert.equal(verifyBolSignature(`${body}x`, header, publicDer), false);
});

test("bol.com subscription envelopes normalize their nested event resource", () => {
  const event = normalizeBolEvent({
    retailerId: 1234567,
    timestamp: "2026-07-27T12:00:00+02:00",
    event: {
      resource: "SHIPMENT",
      type: "UPDATE_TRANSPORT_EVENT",
      resourceId: "shipment-1",
    },
  });
  assert.deepEqual(event, {
    retailerId: "1234567",
    timestamp: "2026-07-27T12:00:00+02:00",
    resource: "SHIPMENT",
    resourceId: "shipment-1",
    eventType: "UPDATE_TRANSPORT_EVENT",
  });
  assert.equal(bolEventId(event!), bolEventId({ ...event! }));
  assert.equal(normalizeBolEvent({ retailerId: "123" }), null);
});
