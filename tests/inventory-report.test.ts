import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { mapBolOffer, mapShopifyVariant, mapWooProduct, wooVariationExternalId } from "../lib/inventory/catalogCore.ts";
import { DEFAULT_INVENTORY_SETTINGS, addDays, buildActions, type InventorySummary, type VariantMetrics } from "../lib/inventory/core.ts";
import { introFacts, introIsGrounded, weeklyEmailDue, weeklyInventoryEmail } from "../lib/inventory/emailCore.ts";
import { buildHistories, buildReport, parseStatusFilter, reportIsStale, reportView, type SalesRow, type VariantRow } from "../lib/inventory/reportCore.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const today = "2026-10-28";

function variant(input: Partial<VariantRow> & { variant_key: string }): VariantRow {
  return {
    provider: "shopify",
    external_id: input.variant_key,
    product_external_id: "p1",
    product_title: "Sneaker C",
    variant_title: null,
    sku: null,
    ean: null,
    options: {},
    price: 40,
    unit_cost: 15,
    stock: 10,
    stock_tracked: true,
    own_warehouse: true,
    status: "active",
    first_seen_at: "2025-06-01T10:00:00Z",
    ...input,
  };
}

function dailySales(variantKey: string, perDay: (index: number) => number, days = 200, channel = "shopify"): SalesRow[] {
  const rows: SalesRow[] = [];
  for (let index = 0; index < days; index += 1) {
    const units = perDay(index);
    if (units) rows.push({ variant_key: variantKey, day: addDays(today, -index), channel, units_sold: units, revenue: units * 40 });
  }
  return rows;
}

// ── Catalog per platform ────────────────────────────────────────────────────

test("Shopify variants become catalog rows with options, stock and cost", () => {
  const row = mapShopifyVariant({
    id: "gid://shopify/ProductVariant/11", sku: "c-37-groen", barcode: "8712345678906", title: "37 / Groen", price: "39.95",
    inventoryQuantity: 4, inventoryItem: { tracked: true, unitCost: { amount: "14.50" } },
    selectedOptions: [{ name: "Maat", value: "37" }, { name: "Kleur", value: "Groen" }],
    product: { id: "gid://shopify/Product/1", title: "Sneaker C", status: "ACTIVE" },
  }, "EUR", true);
  assert.equal(row.variantKey, "sku:C-37-GROEN");
  assert.deepEqual(row.options, { Maat: "37", Kleur: "Groen" });
  assert.equal(row.stock, 4);
  assert.equal(row.unitCost, 14.5);
  assert.equal(row.price, 39.95);
  assert.equal(row.ean, "8712345678906");

  const untracked = mapShopifyVariant({ id: "gid://v/2", title: "Default Title", inventoryQuantity: 5, inventoryItem: { tracked: false }, selectedOptions: [{ name: "Title", value: "Default Title" }], product: { id: "p", title: "Gift card", status: "ARCHIVED" } }, "EUR", true);
  assert.equal(untracked.stock, null);
  assert.equal(untracked.variantTitle, null);
  assert.deepEqual(untracked.options, {});
  assert.equal(untracked.status, "archived");
  // Without read_inventory stock stays unknown instead of zero.
  assert.equal(mapShopifyVariant({ id: "gid://v/3", product: { id: "p", title: "X" } }, "EUR", false).stock, null);
});

test("WooCommerce variations carry the parent's name and match order lines", () => {
  const rows = mapWooProduct(
    { id: 10, name: "Sneaker C", type: "variable", status: "publish", manage_stock: false },
    [
      { id: 11, sku: "C-37-GROEN", price: "39.95", manage_stock: true, stock_quantity: 4, attributes: [{ name: "Maat", option: "37" }, { name: "Kleur", option: "Groen" }], meta_data: [{ key: "_wc_cog_cost", value: "14.5" }] },
      { id: 12, sku: "", price: "39.95", manage_stock: "parent", stock_quantity: null, attributes: [{ name: "Maat", option: "38" }] },
    ],
    "EUR",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].externalId, "10:11");
  assert.equal(rows[0].variantTitle, "37 / Groen");
  assert.equal(rows[0].unitCost, 14.5);
  assert.equal(rows[0].stock, 4);
  assert.equal(rows[1].stock, null);
  assert.equal(rows[1].variantKey, "woocommerce:12");
  assert.equal(wooVariationExternalId("10", "11"), "10:11");
  assert.equal(wooVariationExternalId("20", null), "20");
  const simple = mapWooProduct({ id: 20, name: "Sokken", type: "simple", status: "draft", sku: "SOK", manage_stock: true, stock_quantity: 0 }, [], "EUR");
  assert.equal(simple[0].externalId, "20");
  assert.equal(simple[0].status, "archived");
});

test("bol.com LVB stock counts on top, FBR stock is the shop's own", () => {
  const lvb = mapBolOffer({ external_id: "o1", ean: "8712345678906", fulfilment_method: "FBB", stock_amount: 20, corrected_stock: 18, price: 39.95, currency_code: "EUR", for_sale: true }, { productTitle: "Sneaker C", variantTitle: "37" });
  assert.equal(lvb.ownWarehouse, false);
  assert.equal(lvb.stock, 18);
  assert.equal(lvb.variantKey, "ean:8712345678906");
  const fbr = mapBolOffer({ external_id: "o2", ean: null, fulfilment_method: "FBR", stock_amount: 5, corrected_stock: null, price: null, currency_code: null, for_sale: true }, null);
  assert.equal(fbr.ownWarehouse, true);
  assert.equal(fbr.productTitle, "EAN o2");
});

// ── Report ──────────────────────────────────────────────────────────────────

test("one history per variant: bol.com and Shopify sales of one EAN add up under the webshop name", () => {
  const variants = [
    variant({ variant_key: "sku:C-37", sku: "C-37", ean: "8712345678906", variant_title: "37 / Groen", stock: 4 }),
    variant({ provider: "bol", external_id: "offer-1", variant_key: "ean:8712345678906", ean: "8712345678906", product_title: "EAN 8712345678906", stock: 30, own_warehouse: false }),
    variant({ variant_key: "sku:OLD", sku: "OLD", status: "archived", stock: 0 }),
  ];
  // The bol.com row has its own key in the catalog; the resolver at sync time maps its sales to sku:C-37.
  const histories = buildHistories({
    variants,
    sales: [...dailySales("sku:C-37", () => 1, 10), ...dailySales("sku:C-37", () => 2, 10, "bol"), ...dailySales("sku:OLD", () => 1, 5)],
    stock: [{ variant_key: "sku:C-37", day: today, stock: 4 }],
    deliveries: [{ id: "d1", variant_key: "sku:C-37", received_on: addDays(today, 10), quantity: 50, source: "manual", note: null }],
    returns: [{ ean: "8712345678906", reason: "Valt klein", quantity: 2 }],
    today,
  });
  const green = histories.find((history) => history.variantKey === "sku:C-37")!;
  assert.equal(green.productTitle, "Sneaker C");
  assert.equal(green.sales.get(today), 3);
  assert.deepEqual(green.channels.sort(), ["bol", "shopify"]);
  assert.equal(green.incoming, 50);
  assert.deepEqual(green.returns, { units: 2, reasons: { "Valt klein": 2 } });
  assert.ok(!histories.some((history) => history.variantKey === "sku:OLD"), "archived variant without stock is left out");
});

test("the report and its view: summary, actions, filters, paging", () => {
  const variants = [
    variant({ variant_key: "sku:PINK-32", sku: "PINK-32", variant_title: "32 / Roze", options: { Maat: "32", Kleur: "Roze" }, stock: 40 }),
    variant({ variant_key: "sku:GREEN-37", sku: "GREEN-37", variant_title: "37 / Groen", options: { Maat: "37", Kleur: "Groen" }, stock: 3 }),
    ...Array.from({ length: 60 }, (_, index) => variant({ variant_key: `sku:X${index}`, product_external_id: `x${index}`, product_title: `Product ${index}`, stock: 50 })),
  ];
  const sales = [
    ...dailySales("sku:GREEN-37", (index) => (index % 2 === 0 ? 1 : 0)),
    ...dailySales("sku:PINK-32", (index) => (index === 150 ? 1 : 0)),
    ...variants.slice(2).flatMap((row) => dailySales(row.variant_key, (index) => (index % 3 === 0 ? 1 : 0))),
  ];
  const report = buildReport({ variants, sales, stock: [], deliveries: [], returns: [], today, settings: DEFAULT_INVENTORY_SETTINGS, builtAt: "2026-10-28T05:00:00Z" });
  assert.equal(report.summary.variants, 62);
  assert.equal(report.summary.deadVariants, 1);
  assert.equal(report.summary.deadStockValue, 600);
  assert.equal(report.historyFrom, addDays(today, -198));

  const view = reportView(report, { status: "attention", language: "nl" });
  assert.deepEqual(view.variants.rows.map((row) => row.variantKey).sort(), ["sku:GREEN-37", "sku:PINK-32"]);
  assert.equal(view.actions[0].kind, "stop_buying");
  assert.equal(reportView(report, { status: "all", search: "roze", language: "nl" }).variants.total, 1);
  assert.equal(reportView(report, { status: "all", search: "pink-32", language: "nl" }).variants.total, 1);
  const paged = reportView(report, { status: "all", offset: 50, limit: 50, language: "en" });
  assert.equal(paged.variants.total, 62);
  assert.equal(paged.variants.rows.length, 12);
  assert.equal(reportView(report, { status: "all", limit: 5000, language: "en" }).variants.rows.length, 62);
  assert.equal(parseStatusFilter("dead"), "dead");
  assert.equal(parseStatusFilter("drop table"), "all");
  assert.equal(reportIsStale(report, new Date("2026-10-28T20:00:00Z")), false);
  assert.equal(reportIsStale(report, new Date("2026-10-30T08:00:00Z")), true);
  assert.equal(reportIsStale(null, new Date()), true);
  // The report travels as JSON (cache, API, MCP).
  assert.deepEqual(JSON.parse(JSON.stringify(report)).summary, report.summary);
});

// ── Weekly mail ─────────────────────────────────────────────────────────────

const summary: InventorySummary = { variants: 800, trackedVariants: 790, deadVariants: 12, deadStockValue: 4310.5, deadStockUnits: 230, lowVariants: 7, outOfStockVariants: 3, toOrderVariants: 25, toOrderUnits: 640, stockValue: 52000 };

test("the AI intro is only used when every number in it comes from our figures", () => {
  const facts = introFacts(summary, []);
  assert.ok(introIsGrounded("Er staan 12 varianten stil met €4311 aan voorraad. 7 raken bijna op.", facts));
  assert.ok(introIsGrounded("Er ligt € 4.311 stil.", facts));
  assert.ok(!introIsGrounded("Je verkocht 18% meer dan vorige week.", facts));
  assert.ok(introIsGrounded("Een rustige week zonder grote verrassingen.", facts));
});

test("the weekly mail lists the actions with a link to the page", () => {
  const metrics: VariantMetrics[] = [];
  const actions = buildActions(metrics, DEFAULT_INVENTORY_SETTINGS, "nl");
  const empty = weeklyInventoryEmail({ summary, actions, language: "nl", appUrl: "https://support.sequenceflow.io", shopName: "Winkel B", intro: null });
  assert.match(empty.subject, /Inkoopadvies deze week voor Winkel B: 0 acties/);
  assert.match(empty.text, /Geen acties deze week/);
  assert.match(empty.text, /https:\/\/support\.sequenceflow\.io\/inventory/);
  assert.match(empty.text, /€\s?4\.311/);
  const withIntro = weeklyInventoryEmail({ summary, actions: [{ kind: "stop_buying", variantKey: "k", title: "Niet bijkopen: X", text: "40 op voorraad.", impact: 1, quantity: 0 }], language: "en", appUrl: "https://a.b", shopName: null, intro: "Quiet week." });
  assert.match(withIntro.text, /Quiet week\.\n/);
  assert.match(withIntro.text, /1\. Niet bijkopen: X\n {3}40 op voorraad\./);
  assert.match(withIntro.subject, /1 action$/);
});

test("the weekly mail goes out on Monday (Amsterdam), at most once a week", () => {
  const monday = new Date("2026-11-02T05:00:00Z");
  assert.equal(weeklyEmailDue(monday, null), true);
  assert.equal(weeklyEmailDue(monday, "2026-10-26T05:00:00Z"), true);
  assert.equal(weeklyEmailDue(monday, "2026-11-02T04:00:00Z"), false);
  assert.equal(weeklyEmailDue(new Date("2026-11-03T05:00:00Z"), null), false);
  // Sunday 23:30 UTC is already Monday in Amsterdam.
  assert.equal(weeklyEmailDue(new Date("2026-11-01T23:30:00Z"), null), true);
});

// ── Safety of the routes and the feature flag ───────────────────────────────

test("every inventory query is scoped to one workspace", () => {
  for (const path of ["lib/inventory/sync.ts", "lib/inventory/imports.ts", "app/api/inventory/deliveries/route.ts", "app/api/inventory/settings/route.ts"]) {
    const code = source(path);
    const statements = code.split(/(?=\.from\(")/).slice(1).map((part) => part.split(/;\n/)[0]);
    assert.ok(statements.length > 0, path);
    for (const statement of statements) {
      assert.match(statement, /tenant_id|tenantId/, `${path}: ${statement.slice(0, 80)}`);
    }
  }
  const routes = ["route.ts", "sync/route.ts", "import/route.ts", "deliveries/route.ts", "settings/route.ts", "season/route.ts"].map((file) => source(`app/api/inventory/${file}`));
  for (const route of routes) assert.match(route, /inventoryContext\(req/);
});

test("only admins change anything; reading is for the whole workspace", () => {
  const writes = [
    ["app/api/inventory/sync/route.ts", "POST"],
    ["app/api/inventory/import/route.ts", "POST"],
    ["app/api/inventory/deliveries/route.ts", "POST"],
    ["app/api/inventory/deliveries/route.ts", "DELETE"],
    ["app/api/inventory/settings/route.ts", "PATCH"],
  ] as const;
  for (const [path, method] of writes) {
    const body = source(path).split(`export async function ${method}`)[1].split("export async function")[0];
    assert.match(body, /inventoryContext\(req, true\)/, `${method} ${path}`);
  }
  assert.match(source("lib/inventory/routeHelpers.ts"), /adminOnly \? requireRole\(context, \["admin"\]\)/);
  // Detected deliveries come back from stock; only entered and imported ones can be removed.
  assert.match(source("app/api/inventory/deliveries/route.ts"), /\.neq\("source", "detected"\)/);
});

test("nothing is live while the flag is off", () => {
  assert.match(source("lib/inventory/sync.ts"), /NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED === "true"/);
  assert.match(source("lib/inventory/routeHelpers.ts"), /if \(!inventoryAdviceEnabled\(\)\) return \{ response: NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\) \}/);
  assert.match(source("app/(app)/inventory/page.tsx"), /NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED !== "true"\) notFound\(\)/);
  assert.match(source("components/Sidebar.tsx"), /NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED === "true" \? \[\{ key: "inventory"/);
  const cron = source("app/api/cron/inventory/route.ts");
  assert.match(cron, /if \(!authorized\(req\)\)/);
  assert.match(cron, /if \(!inventoryAdviceEnabled\(\)\) return NextResponse\.json\(\{ ok: true, skipped: "disabled" \}\)/);
  assert.match(source("lib/mcp/tools.ts"), /inventoryAdviceEnabled\(\) \? \[\.\.\.BASE_TOOLS, \.\.\.PLAN_GATED_INVENTORY_TOOLS\] : BASE_TOOLS/);
});

test("the migration keeps product data apart from people and readable only per workspace", () => {
  const migration = source("supabase/migrations/057_inventory_advice.sql");
  for (const table of ["inventory_variants", "inventory_daily_sales", "inventory_daily_stock", "inventory_deliveries", "inventory_settings"]) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON %I FROM authenticated/);
  // No column for a person: only products, quantities and money (comments aside).
  assert.doesNotMatch(migration.replace(/--.*$/gm, ""), /customer|\b\w*email\w* text|address|phone|\b(first_|last_|full_)?name text/i);
  const cleanup = source("app/api/cron/cleanup-old-email/route.ts");
  assert.match(cleanup, /from\("inventory_daily_sales"\)\.delete\(\)/);
  assert.match(cleanup, /INVENTORY_SALES_RETENTION_DAYS = 3 \* 366/);
});

// ── Scale only ──────────────────────────────────────────────────────────────

test("only Scale and custom plans get stock advice; the rest sees a locked preview", async () => {
  const { INVENTORY_PLANS } = await import("../lib/billingPlans.ts");
  assert.deepEqual([...INVENTORY_PLANS].sort(), ["agency", "custom"]);
  for (const plan of ["trial", "starter", "pro", "expired"]) assert.ok(!INVENTORY_PLANS.includes(plan as never), plan);

  // Every API route goes through the plan check; the cron and MCP check it too.
  assert.match(source("lib/inventory/routeHelpers.ts"), /INVENTORY_PLANS\.includes\(plan\)[\s\S]*upgrade: true[\s\S]*status: 403/);
  assert.match(source("app/api/cron/inventory/route.ts"), /INVENTORY_PLANS\.includes\([\s\S]*skipped: "plan"/);
  assert.match(source("lib/mcp/tools.ts"), /PLAN_GATED_INVENTORY_TOOLS/);
  for (const route of ["route", "sync/route", "import/route", "deliveries/route", "settings/route", "season/route"]) {
    assert.match(source(`app/api/inventory/${route}.ts`), /inventoryContext\(/, route);
  }
});

test("the locked preview is a real report with something in every tile", async () => {
  const { inventoryDemoView } = await import("../lib/inventory/demo.ts");
  const view = inventoryDemoView(today, "nl");
  assert.ok(view.summary.deadVariants > 0 && view.summary.lowVariants > 0 && view.summary.outOfStockVariants > 0);
  assert.ok(view.actions.length >= 4);
  assert.ok(view.variants.rows.every((row) => ["dead", "low", "out_of_stock"].includes(row.status)));
  // Same input, same picture.
  assert.deepEqual(inventoryDemoView(today, "nl"), view);
});
