import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseCommerceConnection } from "../lib/commerce/connectionChoice.ts";

const bol = { provider: "bol" };
const shopify = { provider: "shopify" };

test("a bol mail uses bol, other mail uses the own shop", () => {
  assert.equal(chooseCommerceConnection([bol, shopify], { recognizedBolMail: true }), bol);
  assert.equal(chooseCommerceConnection([bol, shopify], { recognizedBolMail: false }), shopify);
});

test("with one connection that connection is used, whatever the mail", () => {
  assert.equal(chooseCommerceConnection([bol], { recognizedBolMail: false }), bol);
  assert.equal(chooseCommerceConnection([shopify], { recognizedBolMail: true }), shopify);
  assert.equal(chooseCommerceConnection([], { recognizedBolMail: false }), null);
});
