import { DEFAULT_INVENTORY_SETTINGS, addDays } from "./core.ts";
import type { QuestionConversation } from "./questionsCore.ts";
import { buildReport, reportView, type SalesRow, type StockRow, type VariantRow } from "./reportCore.ts";

/**
 * A made-up shop for the locked preview that plans below Scale see: the real
 * page, filled with sample numbers, greyed out under an upgrade card. Built
 * with the same rules as a real report so it never shows something the
 * feature cannot do.
 */

type DemoVariant = {
  product: string;
  productId: string;
  options: Record<string, string>;
  price: number;
  cost: number;
  stock: number;
  /** Units sold per week over the last 120 days. */
  perWeek: number;
  /** Days since the last sale; sales stop then. */
  quietDays?: number;
};

const SNEAKER = { product: "Sneaker C", productId: "snk-c", price: 79.95, cost: 31 };
const HOODIE = { product: "Hoodie Basic", productId: "hoodie", price: 49.95, cost: 18 };

const DEMO: DemoVariant[] = [
  { ...SNEAKER, options: { Maat: "36", Kleur: "Groen" }, stock: 9, perWeek: 2 },
  { ...SNEAKER, options: { Maat: "37", Kleur: "Groen" }, stock: 4, perWeek: 7 },
  { ...SNEAKER, options: { Maat: "38", Kleur: "Groen" }, stock: 6, perWeek: 6 },
  { ...SNEAKER, options: { Maat: "39", Kleur: "Groen" }, stock: 14, perWeek: 3 },
  { ...SNEAKER, options: { Maat: "40", Kleur: "Groen" }, stock: 11, perWeek: 1.5 },
  { ...SNEAKER, options: { Maat: "36", Kleur: "Roze" }, stock: 3, perWeek: 3 },
  { ...SNEAKER, options: { Maat: "37", Kleur: "Roze" }, stock: 8, perWeek: 2.5 },
  { ...SNEAKER, options: { Maat: "38", Kleur: "Roze" }, stock: 12, perWeek: 1 },
  { ...SNEAKER, options: { Maat: "39", Kleur: "Roze" }, stock: 22, perWeek: 0.3, quietDays: 95 },
  { ...SNEAKER, options: { Maat: "40", Kleur: "Roze" }, stock: 26, perWeek: 0.2, quietDays: 110 },
  { ...HOODIE, options: { Maat: "S", Kleur: "Zwart" }, stock: 18, perWeek: 2 },
  { ...HOODIE, options: { Maat: "M", Kleur: "Zwart" }, stock: 0, perWeek: 5, quietDays: 6 },
  { ...HOODIE, options: { Maat: "L", Kleur: "Zwart" }, stock: 7, perWeek: 3 },
];

const HISTORY_DAYS = 120;

/** Made-up inbox questions, worded the way customers write them. */
const DEMO_QUESTIONS: Array<[number, string]> = [
  [9, "Wanneer is de Hoodie Basic in maat M weer op voorraad?"],
  [7, "Valt de Sneaker C klein? Twijfel tussen 38 en 39"],
  [4, "Sneaker C groen 37 uitverkocht? Komt die nog terug?"],
  [3, "De kleur van de Sneaker C roze wijkt af van de foto"],
];

function demoConversations(): QuestionConversation[] {
  return DEMO_QUESTIONS.flatMap(([count, text], group) => Array.from({ length: count }, (_, index) => ({ id: `demo-${group}-${index}`, text, intent: "product_question", orderVariantKeys: [] })));
}

export function inventoryDemoView(today: string, language: "nl" | "en") {
  const variants: VariantRow[] = [];
  const sales: SalesRow[] = [];
  const stock: StockRow[] = [];
  DEMO.forEach((item, index) => {
    const sku = `${item.productId}-${Object.values(item.options).join("-")}`.toUpperCase();
    const variantKey = `sku:${sku}`;
    variants.push({
      provider: index % 3 === 0 ? "bol" : "shopify",
      external_id: sku,
      variant_key: variantKey,
      product_external_id: item.productId,
      product_title: item.product,
      variant_title: Object.values(item.options).join(" / "),
      sku,
      ean: null,
      options: item.options,
      price: item.price,
      unit_cost: item.cost,
      stock: item.stock,
      stock_tracked: true,
      own_warehouse: true,
      status: "active",
      first_seen_at: `${addDays(today, -HISTORY_DAYS)}T09:00:00Z`,
    });
    // Walk back from today: stock on a day is today's stock plus what sold after it.
    let level = item.stock;
    let carry = 0;
    for (let ago = 0; ago < HISTORY_DAYS; ago += 1) {
      const day = addDays(today, -ago);
      stock.push({ variant_key: variantKey, day, stock: level });
      if (ago < (item.quietDays ?? 0)) continue;
      // Spread the weekly rate over the days without randomness, so the preview never changes.
      carry += item.perWeek / 7;
      const units = Math.floor(carry);
      carry -= units;
      if (!units) continue;
      sales.push({ variant_key: variantKey, day, channel: index % 3 === 0 ? "bol" : "shopify", units_sold: units, revenue: units * item.price });
      level += units;
    }
  });
  const report = buildReport({ variants, sales, stock, deliveries: [], returns: [], conversations: demoConversations(), today, settings: DEFAULT_INVENTORY_SETTINGS, builtAt: `${today}T05:00:00Z` });
  return reportView(report, { status: "attention", language, limit: 50 });
}
