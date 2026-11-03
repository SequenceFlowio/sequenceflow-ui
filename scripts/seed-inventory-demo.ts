/**
 * Demo-voorraad voor één werkruimte zonder gekoppelde winkel: een verzonnen
 * kledingwinkel met ruim twee jaar verkoop, seizoenen, leveringen, dode
 * voorraad, uitverkochte maten en klantvragen. Schrijft SQL voor de Supabase
 * SQL-editor (opnieuw draaien vervangt de vorige demo) en een SQL om hem weer
 * te verwijderen, en laat zien wat het rapport ervan maakt.
 *
 *   node --experimental-strip-types scripts/seed-inventory-demo.ts --email you@example.com [--out supabase/.temp]
 *
 * Deterministisch: dezelfde dag geeft dezelfde winkel.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_INVENTORY_SETTINGS, addDays, daysBetween, shopDay, variantLabel } from "../lib/inventory/core.ts";
import type { QuestionConversation } from "../lib/inventory/questionsCore.ts";
import { DEFAULT_ALERT_RULES, alertEmail, evaluateAlerts } from "../lib/inventory/alertsCore.ts";
import { buildPurchaseOrder, purchaseOrderCsv } from "../lib/inventory/assistantCore.ts";
import { buildReport, reportActions, reportQuestionInsights, type DeliveryRow, type SalesRow, type StockRow, type VariantRow } from "../lib/inventory/reportCore.ts";

const DEMO_EMAIL_DOMAIN = "demo-klant.example";
const HISTORY_DAYS = 790;
/** The report reads stock of the last 120 days and deliveries of the last 400. */
const STOCK_DAYS = 120;
const DELIVERY_DAYS = 400;

// ── The shop ────────────────────────────────────────────────────────────────

type Months = [number, number, number, number, number, number, number, number, number, number, number, number];

type Product = {
  id: string;
  title: string;
  skuPrefix: string;
  price: number;
  cost: number;
  /** Units a week for the whole product today, before season. */
  perWeek: number;
  season: Months;
  sizes: Array<[string, number]>;
  colours: Array<[string, number]>;
  /** Share of sales on bol.com; products without it are webshop only. */
  bolShare?: number;
  launchedDaysAgo?: number;
  minOrder: number;
};

type Scenario = {
  /** No more orders after this many days ago. */
  noReorderDaysAgo?: number;
  /** Demand stops this many days ago (the colour fell out of favour). */
  quietDaysAgo?: number;
  /** Demand multiplier on top of the size and colour share. */
  demand?: number;
  /** A one-off large order that arrived this many days ago. */
  bigDelivery?: { daysAgo: number; quantity: number };
  /** Ordered, not yet delivered: arrives this many days from now. */
  incoming?: { inDays: number; quantity: number };
  /** Everything left sells on this day (a sudden run on one variant). */
  sellOutDaysAgo?: number;
  startStock?: number;
};

const LETTERS: Array<[string, number]> = [["S", 0.8], ["M", 1.3], ["L", 1.2], ["XL", 0.7]];

const PRODUCTS: Product[] = [
  {
    id: "8812001", title: "Urban Sneaker", skuPrefix: "URB", price: 89.95, cost: 34, perWeek: 46, bolShare: 0.35, minOrder: 6,
    season: [0.8, 0.8, 1.1, 1.2, 1.3, 1.2, 1.1, 1, 1, 0.9, 1.1, 1.2],
    sizes: [["36", 0.4], ["37", 0.6], ["38", 0.9], ["39", 1.1], ["40", 1.2], ["41", 1.3], ["42", 1.2], ["43", 0.8], ["44", 0.5]],
    colours: [["Wit", 0.6], ["Zwart", 0.4]],
  },
  {
    id: "8812002", title: "Essential Hoodie", skuPrefix: "HOOD", price: 59.95, cost: 21, perWeek: 32, minOrder: 10,
    season: [1.3, 1.1, 0.9, 0.7, 0.5, 0.4, 0.4, 0.6, 1, 1.4, 1.6, 1.6],
    sizes: LETTERS, colours: [["Zwart", 0.5], ["Grijs", 0.35], ["Groen", 0.15]],
  },
  {
    id: "8812003", title: "Parka Nordic", skuPrefix: "PARKA", price: 179, cost: 72, perWeek: 17, minOrder: 5,
    season: [1.2, 0.6, 0.2, 0.05, 0.02, 0.02, 0.02, 0.05, 0.4, 1.4, 2.8, 2.6],
    sizes: LETTERS, colours: [["Navy", 0.6], ["Olijf", 0.4]],
  },
  {
    id: "8812004", title: "Linnen Zomerjurk", skuPrefix: "JURK", price: 69.95, cost: 24, perWeek: 19, minOrder: 8,
    season: [0.05, 0.05, 0.2, 0.6, 1.6, 2.6, 2.8, 1.6, 0.4, 0.05, 0.02, 0.02],
    sizes: [["XS", 0.6], ["S", 1.1], ["M", 1.3], ["L", 0.8]], colours: [["Zand", 0.45], ["Terracotta", 0.35], ["Blauw", 0.2]],
  },
  {
    id: "8812005", title: "Sokken 3-pack", skuPrefix: "SOK", price: 14.95, cost: 4.2, perWeek: 64, bolShare: 0.3, minOrder: 30,
    season: [1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1, 1, 1.2, 1.5],
    sizes: [["36-40", 0.9], ["41-46", 1.1]], colours: [["Mix", 1]],
  },
  {
    id: "8812006", title: "Merino Beanie", skuPrefix: "BEANIE", price: 24.95, cost: 7.5, perWeek: 14, minOrder: 10,
    season: [1.4, 0.9, 0.4, 0.2, 0.1, 0.05, 0.05, 0.1, 0.5, 1.4, 2.2, 2.6],
    sizes: [["One size", 1]], colours: [["Zwart", 0.45], ["Camel", 0.35], ["Bordeaux", 0.2]],
  },
  {
    id: "8812007", title: "Corduroy Overshirt", skuPrefix: "OVERSHIRT", price: 74.95, cost: 27, perWeek: 22, launchedDaysAgo: 19, minOrder: 10,
    season: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    sizes: LETTERS, colours: [["Bruin", 1]],
  },
];

/** Stories the demo should tell, by SKU. */
const SCENARIOS: Record<string, Scenario> = {
  // Sold out a week ago; a delivery is on its way. Customers keep asking.
  "HOOD-M-ZWART": { noReorderDaysAgo: 60, demand: 1.3, incoming: { inDays: 9, quantity: 40 } },
  // A run on the white 38 after a post went viral: sold out, nothing ordered.
  "URB-38-WIT": { noReorderDaysAgo: 70, demand: 1.3, sellOutDaysAgo: 12 },
  // Bought far too many at once.
  "URB-44-ZWART": { bigDelivery: { daysAgo: 55, quantity: 60 } },
  // The green hoodie stopped selling; the last big batch is still there.
  "HOOD-L-GROEN": { quietDaysAgo: 120, noReorderDaysAgo: 200, bigDelivery: { daysAgo: 210, quantity: 45 } },
  "HOOD-XL-GROEN": { quietDaysAgo: 110, noReorderDaysAgo: 200, bigDelivery: { daysAgo: 210, quantity: 38 } },
  "HOOD-S-GROEN": { demand: 0.5, noReorderDaysAgo: 150 },
  // A strong seller with a small buffer: runs out soon.
  "SOK-41-46-MIX": { demand: 1.25 },
};

// ── Simulation ──────────────────────────────────────────────────────────────

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function poisson(rand: () => number, lambda: number) {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let product = rand();
  let count = 0;
  while (product > limit) {
    count += 1;
    product *= rand();
  }
  return count;
}

/** Season by day, sliding between the middles of the months; plus Black Friday and December gifts. */
function seasonOn(product: Product, day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  const month = date.getUTCMonth();
  const position = date.getUTCDate() / 30 - 0.5;
  const next = (month + (position >= 0 ? 1 : 11)) % 12;
  let value = product.season[month] + (product.season[next] - product.season[month]) * Math.abs(position);
  const blackFriday = blackFridayOf(date.getUTCFullYear());
  const fromBlackFriday = daysBetween(blackFriday, day);
  if (fromBlackFriday >= -1 && fromBlackFriday <= 3) value *= 2.4;
  if (month === 11 && date.getUTCDate() <= 20) value *= 1.25;
  return value;
}

function blackFridayOf(year: number) {
  const date = new Date(Date.UTC(year, 10, 30, 12));
  while (date.getUTCDay() !== 5) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

const WEEKDAY = [1.25, 1.15, 1, 0.95, 0.95, 0.85, 0.85];

type SimVariant = {
  row: VariantRow;
  bolRow: VariantRow | null;
  sales: Array<{ day: string; channel: "shopify" | "bol"; units: number }>;
  stockByDay: Map<string, number>;
  deliveries: Array<{ day: string; quantity: number; source: "detected" | "manual" }>;
};

function simulate(today: string) {
  const start = addDays(today, -HISTORY_DAYS);
  const variants: SimVariant[] = [];
  let ean = 8719300000000;
  let externalId = 46100000000;
  for (const product of PRODUCTS) {
    const sizeTotal = product.sizes.reduce((sum, [, weight]) => sum + weight, 0);
    const colourTotal = product.colours.reduce((sum, [, weight]) => sum + weight, 0);
    const launch = product.launchedDaysAgo ? addDays(today, -product.launchedDaysAgo) : start;
    for (const [colour, colourWeight] of product.colours) {
      for (const [size, sizeWeight] of product.sizes) {
        const sku = [product.skuPrefix, size === "One size" ? null : size, colour].filter(Boolean).join("-").toUpperCase();
        const scenario = SCENARIOS[sku] ?? {};
        const rand = random(hash(`${sku}|${today}`));
        const share = (sizeWeight / sizeTotal) * (colourWeight / colourTotal) * (scenario.demand ?? 1);
        const perDay = (product.perWeek * share) / 7;
        const options: Record<string, string> = size === "One size" ? { Kleur: colour } : { Maat: size, Kleur: colour };
        const variantEan = product.bolShare ? String((ean += 1)) : null;
        const leadTime = DEFAULT_INVENTORY_SETTINGS.leadTimeDays;

        let stock = scenario.startStock ?? Math.max(product.minOrder, Math.round(perDay * 7 * (product.launchedDaysAgo ? 5 : 8)));
        const pending: Array<{ day: string; quantity: number }> = [];
        const sim: SimVariant = { row: null as unknown as VariantRow, bolRow: null, sales: [], stockByDay: new Map(), deliveries: [] };
        const recent: number[] = [];
        for (let day = launch; day <= today; day = addDays(day, 1)) {
          const ago = daysBetween(day, today);
          for (const order of pending.filter((entry) => entry.day === day)) {
            stock += order.quantity;
            sim.deliveries.push({ day, quantity: order.quantity, source: "detected" });
          }
          if (scenario.bigDelivery && ago === scenario.bigDelivery.daysAgo) {
            stock += scenario.bigDelivery.quantity;
            sim.deliveries.push({ day, quantity: scenario.bigDelivery.quantity, source: "detected" });
          }
          // The shop grew about 30% a year.
          const growth = Math.pow(1.3, -ago / 365);
          const quiet = scenario.quietDaysAgo != null && ago <= scenario.quietDaysAgo;
          const weekday = WEEKDAY[new Date(`${day}T12:00:00Z`).getUTCDay()];
          const demand = quiet ? 0 : poisson(rand, perDay * seasonOn(product, day) * weekday * growth);
          const sold = ago === scenario.sellOutDaysAgo ? stock : Math.min(stock, demand);
          stock -= sold;
          if (sold > 0) {
            let bol = 0;
            if (product.bolShare) for (let unit = 0; unit < sold; unit += 1) if (rand() < product.bolShare) bol += 1;
            if (sold - bol > 0) sim.sales.push({ day, channel: "shopify", units: sold - bol });
            if (bol > 0) sim.sales.push({ day, channel: "bol", units: bol });
          }
          recent.push(sold);
          if (recent.length > 28) recent.shift();
          sim.stockByDay.set(day, stock);

          // A busy owner: on Mondays, reorder on the last four weeks' sales.
          const monday = new Date(`${day}T12:00:00Z`).getUTCDay() === 1;
          const mayOrder = scenario.noReorderDaysAgo == null || ago > scenario.noReorderDaysAgo;
          if (monday && mayOrder && day < today) {
            const onOrder = pending.filter((entry) => entry.day > day).reduce((sum, entry) => sum + entry.quantity, 0);
            const average = recent.reduce((sum, units) => sum + units, 0) / recent.length;
            const basis = average > 0 ? average : stock === 0 && onOrder === 0 && !quiet ? perDay * 0.6 : 0;
            if (basis > 0 && stock + onOrder < basis * (leadTime + 35)) {
              const quantity = Math.max(product.minOrder, Math.ceil((basis * (leadTime + 70)) / 5) * 5);
              const arrives = addDays(day, leadTime - 4 + Math.floor(rand() * 14));
              pending.push({ day: arrives, quantity });
            }
          }
        }
        for (const order of pending.filter((entry) => entry.day > today)) sim.deliveries.push({ day: order.day, quantity: order.quantity, source: "manual" });
        if (scenario.incoming) sim.deliveries.push({ day: addDays(today, scenario.incoming.inDays), quantity: scenario.incoming.quantity, source: "manual" });

        const variantKey = `sku:${sku}`;
        const base = {
          variant_key: variantKey,
          product_title: product.title,
          variant_title: Object.values(options).join(" / "),
          options,
          price: product.price,
          unit_cost: product.cost,
          stock,
          stock_tracked: true,
          own_warehouse: true,
          status: "active",
          first_seen_at: `${launch}T08:00:00Z`,
        };
        sim.row = { ...base, provider: "shopify", external_id: String((externalId += 1)), product_external_id: product.id, sku, ean: variantEan };
        if (product.bolShare) sim.bolRow = { ...base, provider: "bol", external_id: `offer-${variantEan}`, product_external_id: null, sku: null, ean: variantEan };
        variants.push(sim);
      }
    }
  }
  return variants;
}

// ── Customer questions ──────────────────────────────────────────────────────

const QUESTIONS: Array<{ count: number; daysAgo: [number, number]; subjects: string[]; bodies: string[] }> = [
  {
    count: 11, daysAgo: [1, 14],
    subjects: ["Hoodie maat M zwart", "Wanneer weer op voorraad?", "Essential Hoodie uitverkocht"],
    bodies: [
      "Hoi, wanneer is de Essential Hoodie in maat M zwart weer op voorraad? Ik wil hem graag bestellen.",
      "Ik zie dat de Essential Hoodie zwart in maat M uitverkocht is. Komt die nog terug?",
      "Hallo! Krijgen jullie de Essential Hoodie zwart maat M nog binnen? Het is een cadeau.",
    ],
  },
  {
    count: 7, daysAgo: [2, 30],
    subjects: ["Sneaker maat 38", "Urban Sneaker wit", "Vraag over voorraad"],
    bodies: [
      "Is de Urban Sneaker wit in maat 38 nog leverbaar? Op de site staat hij uitverkocht.",
      "Wanneer komt de Urban Sneaker wit maat 38 weer binnen?",
      "Ik zoek de Urban Sneaker in het wit, maat 38. Weten jullie wanneer die terug is?",
    ],
  },
  {
    count: 6, daysAgo: [3, 70],
    subjects: ["Pasvorm sneaker", "Valt de Urban Sneaker klein?", "Twijfel over maat"],
    bodies: [
      "Valt de Urban Sneaker klein? Ik twijfel tussen 41 en 42.",
      "Hoe valt de Urban Sneaker, normaal of eerder groot? Ik heb normaal maat 42.",
      "Mijn Urban Sneaker maat 41 zit te krap, kan ik ruilen voor een grotere?",
    ],
  },
  {
    count: 5, daysAgo: [1, 25],
    subjects: ["Parka maat", "Vraag over de Parka Nordic", "Maat parka"],
    bodies: [
      "Valt de Parka Nordic olijf in maat M groot? Ik draag meestal M maar wil er een trui onder.",
      "Is de Parka Nordic navy maat L nog op voorraad voor de winter?",
      "Hoe valt de Parka Nordic, ruim of krap? Twijfel tussen maat M en L.",
    ],
  },
  {
    count: 4, daysAgo: [5, 18],
    subjects: ["Stof overshirt", "Corduroy Overshirt kwaliteit"],
    bodies: [
      "Ik heb het Corduroy Overshirt in maat L ontvangen, maar de stof voelt dunner dan ik dacht. Is dat normaal?",
      "Gaat het Corduroy Overshirt maat L niet snel pluizen? De kwaliteit valt me wat tegen.",
    ],
  },
  {
    count: 3, daysAgo: [40, 85],
    subjects: ["Kleur jurk", "Linnen Zomerjurk terracotta"],
    bodies: [
      "De kleur van de Linnen Zomerjurk terracotta wijkt af van de foto, hij is veel donkerder.",
      "Mijn Linnen Zomerjurk terracotta is meer bruin dan op de foto. Kan ik hem retour sturen?",
    ],
  },
];

const NAMES = ["Sanne de Vries", "Lotte Jansen", "Daan Bakker", "Emma Visser", "Noah Smit", "Julia Meijer", "Sem de Boer", "Fleur Mulder", "Lucas de Groot", "Tess Bos", "Finn Vos", "Isa Peters", "Milan Hendriks", "Zoë van Dijk", "Bram Dekker", "Anouk Willems", "Thijs Kok", "Roos Jacobs"];

type DemoConversation = { id: string; messageId: string; name: string; email: string; subject: string; body: string; at: string };

function uuidFrom(rand: () => number) {
  const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${"89ab"[Math.floor(rand() * 4)]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function conversations(now: Date) {
  const rand = random(hash(`questions|${shopDay(now)}`));
  const result: DemoConversation[] = [];
  let person = 0;
  for (const group of QUESTIONS) {
    for (let index = 0; index < group.count; index += 1) {
      const [from, to] = group.daysAgo;
      const at = new Date(now.getTime() - (from + rand() * (to - from)) * 86_400_000).toISOString();
      const name = NAMES[person % NAMES.length];
      const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}.${person}@${DEMO_EMAIL_DOMAIN}`;
      person += 1;
      result.push({ id: uuidFrom(rand), messageId: uuidFrom(rand), name, email, subject: group.subjects[index % group.subjects.length], body: group.bodies[index % group.bodies.length], at });
    }
  }
  return result;
}

// ── SQL ─────────────────────────────────────────────────────────────────────

const text = (value: string | null) => (value == null ? "NULL" : `'${value.replace(/'/g, "''")}'`);
const number = (value: number | null) => (value == null ? "NULL" : String(value));

function variantValues(row: VariantRow) {
  return `(${[text(row.provider), text(row.external_id), text(row.variant_key), text(row.product_external_id), text(row.product_title), text(row.variant_title), text(row.sku), text(row.ean), `${text(JSON.stringify(row.options))}::jsonb`, number(Number(row.price)), number(Number(row.unit_cost)), number(row.stock), `${text(row.first_seen_at)}::timestamptz`].join(", ")})`;
}

/** One array per variant and channel, expanded in Postgres, so the file stays small. */
function seriesValues(key: string, channel: string, first: string, price: number, units: number[]) {
  return `(${text(key)}, ${text(channel)}, DATE '${first}', ${price}, '{${units.join(",")}}'::int[])`;
}

function buildSql(email: string, today: string, variants: SimVariant[], demo: DemoConversation[]) {
  const historyStart = addDays(today, -HISTORY_DAYS);
  const stockStart = addDays(today, -(STOCK_DAYS - 1));
  const rows = variants.flatMap((variant) => [variant.row, ...(variant.bolRow ? [variant.bolRow] : [])]);

  const salesSeries: string[] = [];
  for (const variant of variants) {
    for (const channel of ["shopify", "bol"] as const) {
      const byDay = new Map(variant.sales.filter((sale) => sale.channel === channel).map((sale) => [sale.day, sale.units]));
      if (!byDay.size) continue;
      const units = Array.from({ length: HISTORY_DAYS + 1 }, (_, index) => byDay.get(addDays(historyStart, index)) ?? 0);
      salesSeries.push(seriesValues(variant.row.variant_key, channel, historyStart, Number(variant.row.price), units));
    }
  }
  const stockSeries = variants.map((variant) => {
    const units: number[] = [];
    for (let index = 0; index < STOCK_DAYS; index += 1) units.push(variant.stockByDay.get(addDays(stockStart, index)) ?? -1);
    return seriesValues(variant.row.variant_key, "stock", stockStart, 0, units);
  });
  const deliveries = variants.flatMap((variant) => variant.deliveries
    .filter((delivery) => delivery.day >= addDays(today, -DELIVERY_DAYS))
    .map((delivery) => `(${text(variant.row.variant_key)}, DATE '${delivery.day}', ${delivery.quantity}, ${variant.row.unit_cost}, ${text(delivery.source)}, ${delivery.source === "manual" ? text("Besteld bij leverancier") : "NULL"})`));

  return `-- Demo-voorraad voor ${email}, gemaakt op ${today} met scripts/seed-inventory-demo.ts.
-- Een verzonnen kledingwinkel: ${variants.length} varianten, verkoop sinds ${historyStart}, ${demo.length} klantvragen.
-- Opnieuw draaien vervangt de vorige demo. Weghalen: inventory-demo-remove.sql.
-- Stopt als de werkruimte een gekoppelde winkel heeft, zodat echte data nooit wordt overschreven.

BEGIN;

CREATE TEMP TABLE demo_tenant ON COMMIT DROP AS
SELECT tm.tenant_id AS id
FROM tenant_members tm JOIN auth.users u ON u.id = tm.user_id
WHERE lower(u.email) = lower(${text(email)})
LIMIT 1;

DO $$
DECLARE t uuid := (SELECT id FROM demo_tenant);
BEGIN
  IF t IS NULL THEN RAISE EXCEPTION 'Geen werkruimte gevonden voor ${email}'; END IF;
  IF EXISTS (SELECT 1 FROM commerce_connections WHERE tenant_id = t AND status = 'active') THEN
    RAISE EXCEPTION 'Deze werkruimte heeft een gekoppelde winkel; de demo wordt niet geladen';
  END IF;
END $$;

DELETE FROM inventory_daily_sales WHERE tenant_id = (SELECT id FROM demo_tenant);
DELETE FROM inventory_daily_stock WHERE tenant_id = (SELECT id FROM demo_tenant);
DELETE FROM inventory_deliveries WHERE tenant_id = (SELECT id FROM demo_tenant);
DELETE FROM inventory_variants WHERE tenant_id = (SELECT id FROM demo_tenant);
DELETE FROM support_conversations WHERE tenant_id = (SELECT id FROM demo_tenant) AND customer_email LIKE '%@${DEMO_EMAIL_DOMAIN}';

INSERT INTO inventory_variants (tenant_id, provider, external_id, variant_key, product_external_id, product_title, variant_title, sku, ean, options, price, unit_cost, stock, first_seen_at)
SELECT (SELECT id FROM demo_tenant), v.* FROM (VALUES
${rows.map(variantValues).join(",\n")}
) AS v(provider, external_id, variant_key, product_external_id, product_title, variant_title, sku, ean, options, price, unit_cost, stock, first_seen_at);

INSERT INTO inventory_daily_sales (tenant_id, variant_key, day, channel, units_sold, revenue, orders)
SELECT (SELECT id FROM demo_tenant), s.variant_key, s.first_day + (u.n - 1)::int, s.channel, u.units, round(u.units * s.price, 2), u.units
FROM (VALUES
${salesSeries.join(",\n")}
) AS s(variant_key, channel, first_day, price, units)
CROSS JOIN LATERAL unnest(s.units) WITH ORDINALITY AS u(units, n)
WHERE u.units > 0;

INSERT INTO inventory_daily_stock (tenant_id, variant_key, day, stock)
SELECT (SELECT id FROM demo_tenant), s.variant_key, s.first_day + (u.n - 1)::int, u.stock
FROM (VALUES
${stockSeries.join(",\n")}
) AS s(variant_key, kind, first_day, price, stock)
CROSS JOIN LATERAL unnest(s.stock) WITH ORDINALITY AS u(stock, n)
WHERE u.stock >= 0;

INSERT INTO inventory_deliveries (tenant_id, variant_key, received_on, quantity, unit_cost, source, note)
SELECT (SELECT id FROM demo_tenant), d.* FROM (VALUES
${deliveries.join(",\n")}
) AS d(variant_key, received_on, quantity, unit_cost, source, note);

INSERT INTO support_conversations (id, tenant_id, status, customer_email, customer_name, subject_original, latest_message_at, created_at, updated_at)
SELECT c.id, (SELECT id FROM demo_tenant), 'closed', c.email, c.name, c.subject, c.at, c.at, c.at FROM (VALUES
${demo.map((row) => `('${row.id}'::uuid, ${text(row.email)}, ${text(row.name)}, ${text(row.subject)}, '${row.at}'::timestamptz)`).join(",\n")}
) AS c(id, email, name, subject, at);

INSERT INTO support_messages (id, tenant_id, conversation_id, direction, provider, from_email, from_name, to_email, subject_original, body_original, translation_status, received_at, created_at)
SELECT m.id, (SELECT id FROM demo_tenant), m.conversation_id, 'inbound', 'demo', m.email, m.name, 'support@demo-winkel.example', m.subject, m.body, 'not_needed', m.at, m.at FROM (VALUES
${demo.map((row) => `('${row.messageId}'::uuid, '${row.id}'::uuid, ${text(row.email)}, ${text(row.name)}, ${text(row.subject)}, ${text(row.body)}, '${row.at}'::timestamptz)`).join(",\n")}
) AS m(id, conversation_id, email, name, subject, body, at);

-- The report is rebuilt from these rows on the next visit to /inventory or MCP call.
INSERT INTO inventory_settings (tenant_id, report, report_built_at, last_synced_at, last_sync_error, updated_at)
VALUES ((SELECT id FROM demo_tenant), NULL, NULL, NULL, NULL, now())
ON CONFLICT (tenant_id) DO UPDATE SET report = NULL, report_built_at = NULL, last_synced_at = NULL, last_sync_error = NULL, updated_at = now();

SELECT
  (SELECT count(*) FROM inventory_variants WHERE tenant_id = (SELECT id FROM demo_tenant)) AS variant_rows,
  (SELECT count(*) FROM inventory_daily_sales WHERE tenant_id = (SELECT id FROM demo_tenant)) AS sales_rows,
  (SELECT count(*) FROM inventory_daily_stock WHERE tenant_id = (SELECT id FROM demo_tenant)) AS stock_rows,
  (SELECT count(*) FROM inventory_deliveries WHERE tenant_id = (SELECT id FROM demo_tenant)) AS deliveries,
  (SELECT count(*) FROM support_conversations WHERE tenant_id = (SELECT id FROM demo_tenant) AND customer_email LIKE '%@${DEMO_EMAIL_DOMAIN}') AS questions;

COMMIT;
`;
}

function removeSql(email: string) {
  return `-- Haalt de demo-voorraad van ${email} weer weg (scripts/seed-inventory-demo.ts).
BEGIN;

CREATE TEMP TABLE demo_tenant ON COMMIT DROP AS
SELECT tm.tenant_id AS id
FROM tenant_members tm JOIN auth.users u ON u.id = tm.user_id
WHERE lower(u.email) = lower(${text(email)})
LIMIT 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM commerce_connections WHERE tenant_id = (SELECT id FROM demo_tenant) AND status = 'active') THEN
    RAISE EXCEPTION 'Deze werkruimte heeft een gekoppelde winkel; ruim de voorraad daar niet zomaar op';
  END IF;
END $$;

DELETE FROM inventory_daily_sales WHERE tenant_id = (SELECT id FROM demo_tenant);
DELETE FROM inventory_daily_stock WHERE tenant_id = (SELECT id FROM demo_tenant);
DELETE FROM inventory_deliveries WHERE tenant_id = (SELECT id FROM demo_tenant);
DELETE FROM inventory_variants WHERE tenant_id = (SELECT id FROM demo_tenant);
DELETE FROM support_conversations WHERE tenant_id = (SELECT id FROM demo_tenant) AND customer_email LIKE '%@${DEMO_EMAIL_DOMAIN}';
UPDATE inventory_settings SET report = NULL, report_built_at = NULL, updated_at = now() WHERE tenant_id = (SELECT id FROM demo_tenant);

COMMIT;
`;
}

// ── Preview of the report ───────────────────────────────────────────────────

function preview(today: string, now: Date, variants: SimVariant[], demo: DemoConversation[]) {
  const sales: SalesRow[] = variants.flatMap((variant) => variant.sales.map((sale) => ({ variant_key: variant.row.variant_key, day: sale.day, channel: sale.channel, units_sold: sale.units, revenue: sale.units * Number(variant.row.price) })));
  const stockStart = addDays(today, -(STOCK_DAYS - 1));
  const stock: StockRow[] = variants.flatMap((variant) => [...variant.stockByDay].filter(([day]) => day >= stockStart).map(([day, value]) => ({ variant_key: variant.row.variant_key, day, stock: value })));
  const deliveries: DeliveryRow[] = variants.flatMap((variant) => variant.deliveries.filter((delivery) => delivery.day >= addDays(today, -DELIVERY_DAYS))
    .map((delivery, index) => ({ id: `${variant.row.variant_key}-${index}`, variant_key: variant.row.variant_key, received_on: delivery.day, quantity: delivery.quantity, source: delivery.source, note: null })));
  const questions: QuestionConversation[] = demo.map((row) => ({ id: row.id, text: `${row.subject}\n${row.body}`, intent: null, orderVariantKeys: [] }));
  const report = buildReport({
    variants: variants.flatMap((variant) => [variant.row, ...(variant.bolRow ? [variant.bolRow] : [])]),
    sales, stock, deliveries, returns: [], conversations: questions, today, settings: DEFAULT_INVENTORY_SETTINGS, builtAt: now.toISOString(),
  });
  const statuses = new Map<string, number>();
  for (const metric of report.metrics) statuses.set(metric.status, (statuses.get(metric.status) ?? 0) + 1);
  console.log("Samenvatting:", report.summary);
  console.log("Status per variant:", Object.fromEntries(statuses));
  console.log("Acties:");
  for (const action of reportActions(report, "nl")) console.log(`  - ${action.title} — ${action.text}`);
  console.log("Klantvragen:");
  for (const insight of reportQuestionInsights(report, "nl")) console.log(`  - ${insight.count}× ${insight.label}`);
  const sold = report.metrics.filter((metric) => metric.status === "out_of_stock").map(variantLabel);
  console.log("Uitverkocht:", sold.join(", ") || "–");
  console.log("Deliveries in rapport:", report.deliveries.length, "· verkoop sinds", report.historyFrom);
  // What Vera would say with the default rules, and how her mail reads.
  const rules = DEFAULT_ALERT_RULES.map((rule, index) => ({ id: `default-${index}`, kind: rule.kind, scope: "all" as const, targetKey: null, targetLabel: null, threshold: rule.threshold, enabled: true }));
  const alerts = evaluateAlerts(report, rules, "nl");
  console.log(`Vera (${alerts.length} meldingen):`);
  for (const alert of alerts) console.log(`  - [${alert.kind}] ${alert.title} — ${alert.body}`);
  if (alerts.length) console.log(`\n--- Mail van Vera ---\n${alertEmail({ alerts: alerts.slice(0, 12), language: "nl", appUrl: "https://support.sequenceflow.io", shopName: "Demo-winkel" }).text}\n---`);
  // The draft purchase order Vera would make from this advice (without suppliers: one list).
  const order = buildPurchaseOrder(report, { suppliers: [], productSuppliers: {}, shopName: "Demo-winkel" });
  console.log(`\nConcept-inkooporder: ${order.lines} regels, ${order.units} stuks${order.cost != null ? `, € ${order.cost}` : ""}`);
  console.log(purchaseOrderCsv(order).split("\n").slice(0, 6).join("\n") + (order.lines > 5 ? "\n…" : ""));
}

// ── Main ────────────────────────────────────────────────────────────────────

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

const email = argument("email");
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error("Gebruik: node --experimental-strip-types scripts/seed-inventory-demo.ts --email you@example.com [--out supabase/.temp]");
  process.exit(1);
}
const out = argument("out") ?? "supabase/.temp";
const now = new Date();
const today = shopDay(now);
const variants = simulate(today);
const demo = conversations(now);
mkdirSync(out, { recursive: true });
const seedPath = join(out, "inventory-demo-seed.sql");
const removePath = join(out, "inventory-demo-remove.sql");
writeFileSync(seedPath, buildSql(email, today, variants, demo));
writeFileSync(removePath, removeSql(email));
preview(today, now, variants, demo);
console.log(`\nGeschreven: ${seedPath} en ${removePath}`);
