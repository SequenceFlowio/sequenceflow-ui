import assert from "node:assert/strict";
import test from "node:test";

import { buildQuestionReport, questionGroupLabel, questionInsight, questionTopic, type QuestionCatalogVariant, type QuestionConversation } from "../lib/inventory/questionsCore.ts";

function sneaker(size: string, colour: string, productKey = "shopify:snk-c"): QuestionCatalogVariant {
  return { variantKey: `sku:C-${size}-${colour}`.toUpperCase(), productKey, productTitle: "Sneaker C", options: { Maat: size, Kleur: colour } };
}

const CATALOG: QuestionCatalogVariant[] = [
  sneaker("37", "Groen"), sneaker("38", "Groen"), sneaker("39", "Groen"),
  // The same product on bol.com has its own product key; to a customer it is the same sneaker.
  sneaker("37", "Roze", "bol:snk-c"), sneaker("38", "Roze", "bol:snk-c"),
  ...["S", "M", "L"].map((size) => ({ variantKey: `sku:HOODIE-${size}`, productKey: "shopify:hoodie", productTitle: "Hoodie Basic", options: { Maat: size } })),
];

function ask(text: string, extra: Partial<QuestionConversation> = {}): QuestionConversation {
  return { id: Math.random().toString(36).slice(2), text, intent: null, orderVariantKeys: [], ...extra };
}

test("a question is about the product, or not counted at all", () => {
  assert.equal(questionTopic("Valt de Sneaker C klein? Twijfel tussen 38 en 39", null), "size");
  assert.equal(questionTopic("Is maat M weer op voorraad?", null), "availability");
  assert.equal(questionTopic("Wanneer komt de roze weer binnen?", null), "availability");
  assert.equal(questionTopic("De zool laat los na een week", null), "quality");
  assert.equal(questionTopic("De kleur wijkt echt af van de foto", null), "colour");
  assert.equal(questionTopic("Kan ik deze ruilen?", null), "return");
  assert.equal(questionTopic("Does it run small?", null), "size");
  // Where is my parcel: about delivery, not about the sneaker.
  assert.equal(questionTopic("Waar blijft mijn pakket?", "order_status"), null);
  assert.equal(questionTopic("Ik wil een factuur", "invoice"), null);
  assert.equal(questionTopic("Hoe is het materiaal?", "product_question"), "product");
});

test("the text names product, size and colour; short sizes need the word maat", () => {
  const report = buildQuestionReport([
    ask("Is de Sneaker C in 38 groen weer op voorraad?"),
    ask("Wanneer is de Hoodie Basic in maat M weer binnen?"),
    // A capital M on its own is not a size.
    ask("Hoodie Basic: M vraagt of hij uitverkocht is"),
    // Two sizes named: the size stays open.
    ask("Valt de Sneaker C klein? Twijfel tussen 38 en 39"),
  ], CATALOG);
  const labels = report.groups.map((group) => `${questionGroupLabel(group)}:${group.topTopic}:${group.count}`).sort();
  assert.deepEqual(labels, ["Hoodie Basic · M:availability:1", "Hoodie Basic:availability:1", "Sneaker C · 38 / Groen:availability:1", "Sneaker C:size:1"].sort());
  assert.equal(report.byVariant["SKU:C-38-GROEN"].total, 1);
  assert.equal(report.byVariant["sku:HOODIE-M"].topTopic, "availability");
  assert.equal(report.conversations, 4);
});

test("a colour counts on every size of that colour, across channels", () => {
  const report = buildQuestionReport([ask("De kleur van de Sneaker C roze wijkt af van de foto")], CATALOG);
  assert.deepEqual(report.groups[0].variantKeys.sort(), ["SKU:C-37-ROZE", "SKU:C-38-ROZE"]);
  assert.equal(questionGroupLabel(report.groups[0]), "Sneaker C · Roze");
});

test("a linked order says which variant, unless several products are on it", () => {
  const report = buildQuestionReport([
    // No product named, but the order has one sneaker: that one.
    ask("Hij valt echt te klein, kan ik ruilen?", { orderVariantKeys: ["SKU:C-37-GROEN"] }),
    // Two products and the text points to the hoodie.
    ask("De hoodie valt te groot", { orderVariantKeys: ["SKU:C-37-GROEN", "sku:HOODIE-L"] }),
    // Two products and nothing points to either: not counted.
    ask("Het valt allemaal te klein", { orderVariantKeys: ["SKU:C-37-GROEN", "sku:HOODIE-L"] }),
    // About the parcel, not the product.
    ask("Waar blijft mijn bestelling?", { intent: "order_status", orderVariantKeys: ["SKU:C-37-GROEN"] }),
  ], CATALOG);
  assert.equal(report.byVariant["SKU:C-37-GROEN"].total, 1);
  assert.equal(report.byVariant["SKU:C-37-GROEN"].topTopic, "size");
  assert.equal(report.byVariant["sku:HOODIE-L"].total, 1);
  assert.equal(report.conversations, 2);
});

test("asking for a variant that is sold out says reorder", () => {
  const report = buildQuestionReport(Array.from({ length: 5 }, () => ask("Wanneer is de Hoodie Basic in maat M weer op voorraad?")), CATALOG);
  const short = questionInsight(report.groups[0], new Map([["sku:HOODIE-M", "out_of_stock"]]), "nl");
  assert.match(short, /^5 klanten vroegen wanneer Hoodie Basic · M weer binnen is, en hij is \(bijna\) op/);
  const inStock = questionInsight(report.groups[0], new Map([["sku:HOODIE-M", "healthy"]]), "nl");
  assert.match(inStock, /op voorraad is\. Zet de levertijd/);
});
