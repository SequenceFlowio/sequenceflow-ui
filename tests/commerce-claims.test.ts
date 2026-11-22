import assert from "node:assert/strict";
import test from "node:test";

import { containsCancellationConfirmation, unverifiedCommerceClaims } from "../lib/commerce/claims.ts";

const unknown = { cancelledAt: null, financialStatus: "PAID", fulfillmentStatus: "UNFULFILLED", hasFulfillment: false };

test("claims: stellige beweringen zonder bewijs blijven verboden", () => {
  assert.deepEqual(unverifiedCommerceClaims("Goed nieuws: je bestelling is verzonden en komt morgen aan.", unknown), ["shipping"]);
  assert.deepEqual(unverifiedCommerceClaims("Je pakket is verzonden en zodra het aankomt krijg je een mail.", unknown), ["shipping"]);
  assert.deepEqual(unverifiedCommerceClaims("Your order has been shipped; if you have questions, let us know.", unknown), ["shipping"]);
  assert.deepEqual(unverifiedCommerceClaims("Your refund has been processed successfully.", null), ["refund"]);
  assert.deepEqual(unverifiedCommerceClaims("Your order 1001 has been cancelled and the refund has been processed.", unknown), ["cancellation", "refund"]);
});

test("claims: een voorwaarde of vraag is geen bewering (gevonden met de live testset)", () => {
  assert.deepEqual(unverifiedCommerceClaims("We houden je op de hoogte zodra het pakket is verzonden!", unknown), []);
  assert.deepEqual(unverifiedCommerceClaims("Ik zet dit door zodat we kunnen controleren of de terugbetaling al is verwerkt.", unknown), []);
  assert.deepEqual(unverifiedCommerceClaims("Is je bestelling al verzonden? Dat zoeken we voor je uit.", unknown), []);
  assert.deepEqual(unverifiedCommerceClaims("Zodra uw bestelling is geannuleerd, ontvangt u een bevestiging.", unknown), []);
  assert.deepEqual(unverifiedCommerceClaims("We'll email you as soon as your order has been shipped.", unknown), []);
  assert.deepEqual(unverifiedCommerceClaims("Omdat de bestelling nog niet is verzonden, kan deze worden geannuleerd.", unknown), []);
  assert.deepEqual(unverifiedCommerceClaims("Je bestelling is niet verzonden en ook niet geannuleerd.", unknown), []);
});

test("annuleerbevestiging telt alleen als stellige zin", () => {
  assert.equal(containsCancellationConfirmation("Uw bestelling is succesvol geannuleerd."), true);
  assert.equal(containsCancellationConfirmation("Zodra uw bestelling is geannuleerd, ontvangt u een mail."), false);
});
