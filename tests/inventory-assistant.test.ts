import assert from "node:assert/strict";
import test from "node:test";

import {
  answerIsGrounded,
  assistantTools,
  buildProposal,
  buildPurchaseOrder,
  compactVariant,
  groundingNumbers,
  parseAssistantMessages,
  purchaseOrderCsv,
  purchaseOrderMail,
  runAssistant,
  ungroundedNumbers,
  type AssistantCompletion,
  type ProposalContext,
  type Supplier,
} from "../lib/inventory/assistantCore.ts";
import { DEFAULT_INVENTORY_SETTINGS, addDays, computeInventoryMetrics, type InventorySettings } from "../lib/inventory/core.ts";
import { buildHistories, buildReport, type SalesRow, type StockRow, type VariantRow } from "../lib/inventory/reportCore.ts";

const today = "2026-11-03";

type Item = { sku: string; product: string; stock: number; perDay: number; price?: number; cost?: number | null };

function shop(items: Item[], settings: InventorySettings = DEFAULT_INVENTORY_SETTINGS) {
  const variants: VariantRow[] = [];
  const sales: SalesRow[] = [];
  const stock: StockRow[] = [];
  for (const item of items) {
    const key = `sku:${item.sku}`;
    variants.push({
      provider: "shopify", external_id: item.sku, variant_key: key, product_external_id: item.product, product_title: item.product,
      variant_title: item.sku, sku: item.sku, ean: null, options: {}, price: item.price ?? 50, unit_cost: item.cost === undefined ? 20 : item.cost, stock: item.stock,
      stock_tracked: true, own_warehouse: true, status: "active", first_seen_at: `${addDays(today, -399)}T08:00:00Z`,
    });
    for (let ago = 0; ago < 400; ago += 1) if (item.perDay > 0) sales.push({ variant_key: key, day: addDays(today, -ago), channel: "shopify", units_sold: item.perDay, revenue: item.perDay * (item.price ?? 50) });
    stock.push({ variant_key: key, day: today, stock: item.stock });
  }
  return buildReport({ variants, sales, stock, deliveries: [], returns: [], today, settings, builtAt: `${today}T05:00:00Z` });
}

const suppliers: Supplier[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Textielfabriek Noord", email: "orders@noord.example", leadTimeDays: 10, minOrderQty: 24, note: null },
  { id: "22222222-2222-4222-8222-222222222222", name: "Schoenen Zuid", email: null, leadTimeDays: null, minOrderQty: 0, note: null },
];

function context(report = shop([{ sku: "HOOD-M", product: "Hoodie", stock: 2, perDay: 2 }, { sku: "SNK-38", product: "Sneaker", stock: 0, perDay: 1 }])): ProposalContext {
  let id = 0;
  return { report, suppliers, productSuppliers: { "shopify:Hoodie": suppliers[0].id }, language: "nl", today, newId: () => `p${(id += 1)}` };
}

test("messages: at most 12, each at most 4000 characters, ending with the user", () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? "user" : "assistant", content: `bericht ${index}` }));
  const parsed = parseAssistantMessages(many);
  assert.equal(parsed.length, 12);
  assert.equal(parsed.at(-1)?.role, "user");
  assert.throws(() => parseAssistantMessages([{ role: "assistant", content: "hoi" }]), /geldige vraag/);
  assert.throws(() => parseAssistantMessages([{ role: "user", content: "x".repeat(4001) }]), /geldige vraag/);
  assert.throws(() => parseAssistantMessages("nee"), /ontbreken/);
});

test("grounding: numbers from the tools pass in any Dutch or English spelling, invented ones do not", () => {
  const allowed = groundingNumbers([{ summary: { deadStockValue: 13568.4, lowVariants: 14 }, variants: [{ unitsPerWeek: 7.33, stock: 1889 }, { unitsPerWeek: 1.9, stock: 0 }], today: "2026-11-03" }], ["hoeveel hoodies in maat 44?"], today);
  assert.ok(answerIsGrounded("Er staat € 13.568 vast in dode voorraad, 14 varianten zijn bijna op.", allowed));
  assert.ok(answerIsGrounded("De hoodie verkoopt 7,3 per week en er liggen 1.889 stuks; de andere 1,9 per week.", allowed));
  assert.ok(answerIsGrounded("Je vroeg naar maat 44. Vandaag is 3 november 2026.", allowed));
  // Array lengths and list markers are fine; a sum is not.
  assert.ok(answerIsGrounded("1. Hoodie\n2. Sneaker\nDat zijn 2 varianten.", allowed));
  assert.deepEqual(ungroundedNumbers("Samen is dat 1.903 stuks, ongeveer 15% meer.", allowed), ["1.903", "15"]);
  // Table rules do not count as numbers.
  assert.ok(answerIsGrounded("| Variant | Stuks |\n|---|---:|\n| Hoodie | 1889 |", allowed));
});

test("tools: read tools for everyone, propose tools only for admins", () => {
  const read = assistantTools(false).map((tool) => tool.function.name);
  const all = assistantTools(true).map((tool) => tool.function.name);
  assert.ok(read.includes("list_variants") && !read.includes("propose_delivery"));
  assert.ok(all.includes("propose_delivery") && all.includes("propose_purchase_order"));
});

test("proposals: delivery, season, rule and settings become cards with the right request; bad input is an error for the model", () => {
  const ctx = context();
  const delivery = buildProposal("propose_delivery", { variantKey: "sku:HOOD-M", day: addDays(today, 5), quantity: 40, note: "PO 17" }, ctx);
  assert.ok("proposal" in delivery && delivery.proposal.action === "delivery");
  assert.deepEqual(delivery.proposal.request, { method: "POST", url: "/api/inventory/deliveries", body: { code: "HOOD-M", day: addDays(today, 5), quantity: 40, note: "PO 17" } });
  assert.match(delivery.proposal.summary, /onderweg.*40 stuks Hoodie/);
  assert.ok("error" in buildProposal("propose_delivery", { variantKey: "sku:NOPE", day: today, quantity: 1 }, ctx));
  assert.ok("error" in buildProposal("propose_delivery", { variantKey: "sku:HOOD-M", day: today, quantity: 0 }, ctx));

  const season = buildProposal("propose_product_season", { productKey: "shopify:Hoodie", months: [11, 10, 12] }, ctx);
  assert.ok("proposal" in season && season.proposal.action === "product_season");
  assert.deepEqual(season.proposal.request.body, { productSeason: { productKey: "shopify:Hoodie", months: [10, 11, 12] } });
  assert.match(season.proposal.summary, /okt, nov, dec/);
  assert.ok("error" in buildProposal("propose_product_season", { productKey: "shopify:Hoodie", months: [13] }, ctx));

  const rule = buildProposal("propose_alert_rule", { kind: "stock_below", scope: "variant", targetKey: "sku:HOOD-M", threshold: 10 }, ctx);
  assert.ok("proposal" in rule && rule.proposal.action === "alert_rule");
  assert.deepEqual(rule.proposal.request.body, { kind: "stock_below", scope: "variant", targetKey: "sku:HOOD-M", targetLabel: "Hoodie · HOOD-M", threshold: 10 });
  assert.ok("error" in buildProposal("propose_alert_rule", { kind: "dead_stock_value", scope: "variant", targetKey: "sku:HOOD-M" }, ctx));

  const settings = buildProposal("propose_settings", { leadTimeDays: 14, safetyBuffer: 0.3 }, ctx);
  assert.ok("proposal" in settings && settings.proposal.action === "settings");
  assert.deepEqual(settings.proposal.request.body, { leadTimeDays: 14, safetyBuffer: 0.3 });
  assert.match(settings.proposal.summary, /levertijd 21 → 14, buffer 20% → 30%/);
  assert.ok("error" in buildProposal("propose_settings", { leadTimeDays: 999 }, ctx));
  assert.ok("error" in buildProposal("propose_settings", {}, ctx));
});

test("purchase order: grouped per supplier, at least the minimum order quantity, with CSV and mail draft", () => {
  const report = shop([
    { sku: "HOOD-M", product: "Hoodie", stock: 2, perDay: 2 },
    { sku: "HOOD-L", product: "Hoodie", stock: 300, perDay: 1 },
    { sku: "SNK-38", product: "Sneaker", stock: 0, perDay: 1, cost: null },
  ]);
  const order = buildPurchaseOrder(report, { suppliers, productSuppliers: { "shopify:Hoodie": suppliers[0].id }, shopName: "Demo" });
  assert.equal(order.groups.length, 2);
  const noord = order.groups[0];
  assert.equal(noord.supplier?.name, "Textielfabriek Noord");
  assert.deepEqual(noord.lines.map((line) => line.sku), ["HOOD-M"]);
  assert.ok(noord.lines[0].quantity >= 24 && noord.lines[0].quantity >= report.metrics.find((metric) => metric.sku === "HOOD-M")!.recommendedOrder);
  assert.equal(noord.cost, Math.round(noord.lines[0].quantity * 20 * 100) / 100);
  const rest = order.groups[1];
  assert.equal(rest.supplier, null);
  assert.equal(rest.lines[0].sku, "SNK-38");
  assert.equal(rest.cost, null);
  assert.equal(order.lines, 2);
  assert.equal(order.units, noord.units + rest.units);

  const csv = purchaseOrderCsv(order);
  assert.equal(csv.split("\n")[0], "leverancier;product;variant;sku;ean;aantal;inkoopprijs;totaal");
  assert.match(csv, /Textielfabriek Noord;Hoodie;HOOD-M;HOOD-M;;\d+;20;\d+/);
  const mail = purchaseOrderMail(order, "nl");
  assert.match(mail.subject, /Bestelling Demo 2026-11-03/);
  assert.match(mail.text, /Aan: orders@noord.example/);
  assert.match(mail.text, /Beste Textielfabriek Noord,/);
  assert.match(mail.text, /Beste leverancier,/);
  assert.match(mail.text, /Hoodie · HOOD-M \(SKU HOOD-M\): \d+ stuks à €\s20,00/);

  // Narrowed to one supplier, and empty when nothing needs ordering.
  assert.equal(buildPurchaseOrder(report, { suppliers, productSuppliers: { "shopify:Hoodie": suppliers[0].id }, supplierId: suppliers[0].id }).groups.length, 1);
  assert.equal(buildPurchaseOrder(report, { suppliers, productSuppliers: {}, search: "bestaat niet" }).lines, 0);
});

test("a supplier's lead time drives the order quantity of its products", () => {
  const variants: VariantRow[] = ["A", "B"].map((product) => ({
    provider: "shopify", external_id: product, variant_key: `sku:${product}`, product_external_id: product, product_title: product, variant_title: null, sku: product, ean: null, options: {},
    price: 50, unit_cost: 20, stock: 10, stock_tracked: true, own_warehouse: true, status: "active", first_seen_at: `${addDays(today, -399)}T08:00:00Z`,
  }));
  const sales: SalesRow[] = variants.flatMap((variant) => Array.from({ length: 400 }, (_, ago) => ({ variant_key: variant.variant_key, day: addDays(today, -ago), channel: "shopify", units_sold: 2, revenue: 100 })));
  const stock: StockRow[] = variants.map((variant) => ({ variant_key: variant.variant_key, day: today, stock: 10 }));
  const histories = buildHistories({ variants, sales, stock, deliveries: [], returns: [], today });
  const plain = computeInventoryMetrics(histories, DEFAULT_INVENTORY_SETTINGS, today);
  const withSupplier = computeInventoryMetrics(histories, { ...DEFAULT_INVENTORY_SETTINGS, productLeadTimes: { "shopify:A": 60 } }, today);
  const order = (metrics: typeof plain, key: string) => metrics.find((metric) => metric.variantKey === key)!.recommendedOrder;
  assert.ok(order(withSupplier, "sku:A") > order(plain, "sku:A"), "a longer lead time means ordering more");
  assert.equal(order(withSupplier, "sku:B"), order(plain, "sku:B"), "other products keep the shop's lead time");
});

test("the loop: tools are called, proposals collected, an invented number triggers one rewrite", async () => {
  const report = shop([{ sku: "HOOD-M", product: "Hoodie", stock: 2, perDay: 2 }]);
  const calls: string[] = [];
  const answers = [
    { message: { content: null, tool_calls: [{ id: "c1", type: "function" as const, function: { name: "list_variants", arguments: JSON.stringify({ status: "low" }) } }] } },
    { message: { content: null, tool_calls: [{ id: "c2", type: "function" as const, function: { name: "propose_delivery", arguments: JSON.stringify({ variantKey: "sku:HOOD-M", day: today, quantity: 30 }) } }, { id: "c3", type: "function" as const, function: { name: "nonsense", arguments: "{" } }] } },
    { message: { content: "Hoodie · HOOD-M heeft nog 2 op voorraad en verkoopt 14 per week; samen met de levering zijn dat 32 stuks." }, usage: { prompt_tokens: 100, completion_tokens: 20 } },
    { message: { content: "Hoodie · HOOD-M heeft nog 2 op voorraad en verkoopt 14 per week. Bevestig de kaart om de levering van 30 stuks in te voeren." }, usage: { prompt_tokens: 50, completion_tokens: 10 } },
  ];
  const complete: AssistantCompletion = async ({ messages, tools }) => {
    calls.push(`${messages.at(-1)?.role}:${tools.length}`);
    return answers.shift()!;
  };
  const result = await runAssistant({
    messages: [{ role: "user", content: "Wat is bijna op?" }],
    language: "nl", today, canManage: true, shopName: "Demo", complete,
    runTool: async (tool, args) => {
      calls.push(`tool:${tool}:${JSON.stringify(args)}`);
      return { variants: report.metrics.map(compactVariant) };
    },
    proposalContext: async () => context(report),
  });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].action, "delivery");
  assert.deepEqual(result.toolsUsed, ["list_variants", "propose_delivery"]);
  assert.ok(result.grounded, `ungrounded: ${result.ungrounded.join(", ")}`);
  assert.match(result.answer, /Bevestig de kaart/);
  assert.equal(result.usage.prompt_tokens, 150);
  assert.ok(calls.includes('tool:list_variants:{"status":"low"}'));
  // The rewrite request carries no tools.
  assert.equal(calls.at(-1), "user:0");
});

test("the loop: a reader cannot propose, and a stubborn invented number is reported", async () => {
  const report = shop([{ sku: "HOOD-M", product: "Hoodie", stock: 2, perDay: 2 }]);
  const answers = [
    { message: { content: null, tool_calls: [{ id: "c1", type: "function" as const, function: { name: "propose_settings", arguments: JSON.stringify({ leadTimeDays: 7 }) } }] } },
    { message: { content: "Dat zijn 999 stuks." } },
    { message: { content: "Dat zijn 999 stuks, echt." } },
  ];
  const result = await runAssistant({
    messages: [{ role: "user", content: "Zet de levertijd op 7 dagen" }],
    language: "nl", today, canManage: false, shopName: null,
    complete: async () => answers.shift()!,
    runTool: async () => ({}),
    proposalContext: async () => context(report),
  });
  assert.equal(result.proposals.length, 0);
  assert.equal(result.grounded, false);
  assert.deepEqual(result.ungrounded, ["999"]);
});
