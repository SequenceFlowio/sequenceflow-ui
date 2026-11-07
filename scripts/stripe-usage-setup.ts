/**
 * Zet de nieuwe prijzen klaar in Stripe: vaste maandprijzen (€47/€147/€297)
 * en twee gemeten prijzen (€0,47 gecontroleerd, €0,97 zelfstandig) met hun
 * meters. Veilig om vaker te draaien: bestaande onderdelen worden hergebruikt
 * (op lookup_key, event_name of productnaam).
 *
 *   STRIPE_SECRET_KEY=... node --experimental-strip-types scripts/stripe-usage-setup.ts
 *
 * Met een live-sleutel weigert hij, tenzij je --live meegeeft. Hij print de
 * environment-variabelen die daarna in Vercel moeten. Geen sleutels in de uitvoer.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY ontbreekt");
const live = key.startsWith("sk_live") || key.startsWith("rk_live");
if (live && !process.argv.includes("--live")) throw new Error("Live-sleutel: draai opnieuw met --live als dit echt de bedoeling is");

const stripe = new Stripe(key);
const VERSION = "2026_11";

const PLANS = [
  { id: "starter", name: "Support One Starter", cents: 4700, env: "STRIPE_PRICE_STARTER" },
  { id: "pro", name: "Support One Growth", cents: 14700, env: "STRIPE_PRICE_PRO" },
  { id: "agency", name: "Support One Scale", cents: 29700, env: "STRIPE_PRICE_AGENCY" },
] as const;

// Elk soort afhandeling een eigen product, zodat de klant op de factuur ziet welke regel welke is.
const USAGE = [
  { kind: "assisted", event: "handled_assisted", display: "Afgehandeld, gecontroleerd", product: "Afgehandelde gesprekken, door jou gecontroleerd", cents: 47, env: "STRIPE_PRICE_HANDLED_ASSISTED" },
  { kind: "autonomous", event: "handled_autonomous", display: "Afgehandeld, zelfstandig", product: "Afgehandelde gesprekken, zelfstandig door AI", cents: 97, env: "STRIPE_PRICE_HANDLED_AUTONOMOUS" },
] as const;

async function product(name: string, sfPlan: string) {
  const all = await stripe.products.list({ limit: 100, active: true });
  const found = all.data.find((item) => item.metadata?.sf_plan === sfPlan) ?? all.data.find((item) => item.name === name);
  if (found) return found;
  return stripe.products.create({ name, tax_code: "txcd_10103001", metadata: { sf_plan: sfPlan } });
}

async function priceByLookup(lookupKey: string) {
  const result = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  return result.data[0] ?? null;
}

const env: string[] = [];

for (const plan of PLANS) {
  const lookupKey = `support_one_${plan.id}_base_${VERSION}_${plan.cents}`;
  const owner = await product(plan.name, plan.id);
  const price = (await priceByLookup(lookupKey)) ?? await stripe.prices.create({
    product: owner.id,
    currency: "eur",
    unit_amount: plan.cents,
    recurring: { interval: "month" },
    tax_behavior: "exclusive",
    lookup_key: lookupKey,
    nickname: `${plan.name} basis (${VERSION})`,
  });
  env.push(`${plan.env}=${price.id}`);
}

const meters = await stripe.billing.meters.list({ limit: 100 });
for (const usage of USAGE) {
  const usageProduct = await product(usage.product, `handled_${usage.kind}`);
  const meter = meters.data.find((item) => item.event_name === usage.event && item.status === "active") ?? await stripe.billing.meters.create({
    display_name: usage.display,
    event_name: usage.event,
    default_aggregation: { formula: "sum" },
    customer_mapping: { type: "by_id", event_payload_key: "stripe_customer_id" },
    value_settings: { event_payload_key: "value" },
  });
  const lookupKey = `support_one_handled_${usage.kind}_${VERSION}_${usage.cents}`;
  const existing = await priceByLookup(lookupKey);
  // Een prijs kan niet van product wisselen: hangt hij onder een ander product, dan nemen we de sleutel over.
  const price = existing && existing.product === usageProduct.id ? existing : await stripe.prices.create({
    transfer_lookup_key: true,
    product: usageProduct.id,
    currency: "eur",
    unit_amount: usage.cents,
    recurring: { interval: "month", usage_type: "metered", meter: meter.id },
    tax_behavior: "exclusive",
    lookup_key: lookupKey,
    nickname: `${usage.display} (${VERSION})`,
  });
  env.push(`${usage.env}=${price.id}`);
}

console.log(`${live ? "LIVE" : "Test"}omgeving klaar. Zet in Vercel (${live ? "Production" : "Preview/Development"}):`);
for (const line of env) console.log(line);
console.log("STRIPE_USAGE_BILLING=on");
