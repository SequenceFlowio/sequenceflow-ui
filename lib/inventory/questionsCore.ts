import type { VariantStatus } from "./core.ts";

/**
 * Customer questions per variant: which sizes and colours customers ask about
 * in the support inbox, and what about (fit, back in stock, quality, …).
 * Pure: the sync loads the conversations, this file decides what they are
 * about. Only counts leave this file; no customer text is stored.
 *
 * A conversation counts for a variant when
 * - it is linked to an order with that variant, and the question is about the
 *   product (fit, quality, a return or exchange), not about delivery or payment; or
 * - it names a product from the catalog, and optionally a size or colour
 *   ("is de Sneaker C in 38 weer binnen?"), which also catches questions
 *   before anyone bought it.
 */

export const QUESTION_TOPICS = ["size", "availability", "quality", "return", "colour", "product"] as const;
export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

export type QuestionCounts = { total: number; topics: Partial<Record<QuestionTopic, number>>; topTopic: QuestionTopic | null };

export type QuestionCatalogVariant = { variantKey: string; productKey: string; productTitle: string; options: Record<string, string> };

export type QuestionConversation = {
  id: string;
  /** Subject and the customer's first message. */
  text: string;
  intent: string | null;
  /** Variant keys on the order this conversation is linked to (empty without a linked order). */
  orderVariantKeys: string[];
};

export type QuestionGroup = {
  productKey: string;
  productTitle: string;
  /** The size or colour asked about, e.g. { Maat: "38" }; empty when only the product was named. */
  options: Record<string, string>;
  variantKeys: string[];
  count: number;
  topics: Partial<Record<QuestionTopic, number>>;
  topTopic: QuestionTopic;
};

export type QuestionReport = { conversations: number; byVariant: Record<string, QuestionCounts>; groups: QuestionGroup[] };

/** Intents that are about the parcel or the money, never about the product itself. */
const NOT_ABOUT_PRODUCT = new Set(["order_status", "shipping", "payment", "invoice", "cancellation", "compliment", "missing_items"]);

const TOPIC_PATTERNS: Array<[QuestionTopic, RegExp]> = [
  ["availability", /(weer (op voorraad|leverbaar|binnen|beschikbaar)|uitverkocht|niet (meer )?(op voorraad|leverbaar|beschikbaar)|wanneer (komt|is|zijn|krijgen).{0,40}(binnen|voorraad|leverbaar|beschikbaar)|nieuwe voorraad|back in stock|out of stock|sold out|restock|when .{0,30}available|wieder (verfügbar|lieferbar)|ausverkauft|en rupture|de nouveau disponible)/i],
  ["size", /(\bmaat\b|\bmaten\b|maattabel|pasvorm|valt\b.{0,40}\b(klein|groot|ruim|krap|smal|breed)\b|te (klein|groot|krap|ruim|smal|kort|lang)|zit (te )?(strak|krap|ruim)|\bsize\b|sizing|size chart|\bfit\b|too (small|big|large|tight|loose)|runs? (small|large|big)|größe|passform|zu (klein|groß)|\btaille\b)/i],
  ["quality", /(kapot|beschadigd|\bstuk\b|defect|scheur|gescheurd|loslaten|laat los|kwaliteit|verkleurd|pluist|naad|gat in|broken|damaged|defective|ripped|torn|quality|kaputt|beschädigt|cassé|abîmé)/i],
  ["colour", /(andere kleur|kleur\b.{0,40}\b(wijkt|klopt niet|anders|valt)|kleur dan op|\bkleuren\b|colou?r (is|looks|differs|different)|other colou?r|farbe|couleur)/i],
  ["return", /(retour|terugsturen|terug sturen|ruilen|omruilen|geld terug|\breturn\b|exchange|refund|umtausch|zurücksenden|rückgabe|échanger|rembourse)/i],
];

const INTENT_TOPIC: Record<string, QuestionTopic> = {
  damaged: "quality", damaged_item: "quality", warranty: "quality", complaint: "quality",
  return_request: "return", product_question: "product",
};

/** What a question is about, or null when it is not about the product (delivery, payment, …). */
export function questionTopic(text: string, intent: string | null): QuestionTopic | null {
  for (const [topic, pattern] of TOPIC_PATTERNS) if (pattern.test(text)) return topic;
  if (intent && NOT_ABOUT_PRODUCT.has(intent)) return null;
  if (intent && INTENT_TOPIC[intent]) return INTENT_TOPIC[intent];
  return null;
}

// ── Finding the product and option in the text ──────────────────────────────

/** Words in product titles too generic to identify a product on their own. */
const GENERIC = new Set(["de", "het", "een", "the", "and", "en", "met", "with", "voor", "for", "van", "set", "pack", "nieuw", "new", "maat", "size", "kleur", "color", "colour"]);

function normalize(text: string) {
  return ` ${text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function titleTokens(title: string) {
  return normalize(title).trim().split(" ").filter((token) => token.length >= 2 && !GENERIC.has(token));
}

/** The product is named when every distinctive word of its title appears. A one-word title needs at least four letters. */
function namesProduct(text: string, tokens: string[]) {
  if (!tokens.length) return false;
  if (tokens.length === 1 && tokens[0].length < 4) return false;
  return tokens.every((token) => text.includes(` ${token} `));
}

/** Short letter sizes (S, M, XL) only count after "maat" or "size"; numbers and words count on their own. */
function namesOption(text: string, value: string) {
  const needle = normalize(value).trim();
  if (!needle) return false;
  if (/^[a-z]{1,3}$/.test(needle)) return new RegExp(` (maat|mt|size|grosse|taille) ${needle} `).test(text);
  return text.includes(` ${needle} `);
}

type Product = { productKey: string; productTitle: string; tokens: string[]; variants: QuestionCatalogVariant[] };

/** One product per name: the same sneaker on bol.com and in the webshop is one product to a customer. */
function productsOf(catalog: QuestionCatalogVariant[]) {
  const products = new Map<string, Product>();
  for (const variant of catalog) {
    const name = normalize(variant.productTitle);
    const product = products.get(name) ?? { productKey: variant.productKey, productTitle: variant.productTitle, tokens: titleTokens(variant.productTitle), variants: [] };
    product.variants.push(variant);
    products.set(name, product);
  }
  // Longest titles first: "Sneaker C Low" wins over "Sneaker C".
  return [...products.values()].sort((a, b) => b.tokens.length - a.tokens.length);
}

/**
 * Option values of `variants` that the text names, per option name, in the
 * catalog's order. "38 of 39" names two sizes: then the size is left open.
 */
function namedOptions(text: string, variants: QuestionCatalogVariant[]) {
  const named = new Map<string, Set<string>>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.options)) {
      if (namesOption(text, value)) named.set(name, (named.get(name) ?? new Set()).add(value));
    }
  }
  const order = [...new Set(variants.flatMap((variant) => Object.keys(variant.options)))];
  const options: Record<string, string> = {};
  for (const name of order) {
    const values = named.get(name);
    if (values?.size === 1) options[name] = [...values][0];
  }
  return options;
}

function narrow(variants: QuestionCatalogVariant[], options: Record<string, string>) {
  return variants.filter((variant) => Object.entries(options).every(([name, value]) => variant.options[name] === value));
}

type Match = { product: Product; options: Record<string, string>; variantKeys: string[] };

function matchConversation(conversation: QuestionConversation, products: Product[], byVariant: Map<string, { product: Product; variant: QuestionCatalogVariant }>): Match | null {
  const text = normalize(conversation.text);
  // A linked order says which variants; the text may narrow it to the one they mean.
  const ordered = [...new Set(conversation.orderVariantKeys)].map((key) => byVariant.get(key)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (ordered.length) {
    // On an order a single word of the title is enough: "de hoodie" among a hoodie and a sneaker.
    const named = ordered.filter((entry) => entry.product.tokens.some((token) => token.length >= 4 && text.includes(` ${token} `)));
    const pool = named.length ? named : ordered;
    const options = namedOptions(text, pool.map((entry) => entry.variant));
    const narrowed = pool.filter((entry) => narrow([entry.variant], options).length);
    const chosen = narrowed.length ? narrowed : pool;
    const productKeys = new Set(chosen.map((entry) => entry.product.productKey));
    // Several products on the order and nothing points to one: we cannot tell which.
    if (productKeys.size > 1) return null;
    const product = chosen[0].product;
    // Several variants of one product: the question is about the product, unless the text says which.
    const variantKeys = chosen.length === 1 ? [chosen[0].variant.variantKey] : chosen.map((entry) => entry.variant.variantKey);
    return { product, options: chosen.length === 1 ? chosen[0].variant.options : options, variantKeys };
  }
  for (const product of products) {
    if (!namesProduct(text, product.tokens)) continue;
    const options = namedOptions(text, product.variants);
    const variants = Object.keys(options).length ? narrow(product.variants, options) : [];
    return { product, options, variantKeys: variants.map((variant) => variant.variantKey) };
  }
  return null;
}

function topTopic(topics: Partial<Record<QuestionTopic, number>>): QuestionTopic {
  return (Object.entries(topics) as Array<[QuestionTopic, number]>)
    .sort((a, b) => b[1] - a[1] || QUESTION_TOPICS.indexOf(a[0]) - QUESTION_TOPICS.indexOf(b[0]))[0]?.[0] ?? "product";
}

/**
 * Counts each conversation once: for every variant it is about, and for the
 * group of product plus the size or colour named ("Sneaker C · Maat 38").
 */
export function buildQuestionReport(conversations: QuestionConversation[], catalog: QuestionCatalogVariant[], limit = 20): QuestionReport {
  const products = productsOf(catalog);
  const byVariant = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.variantKey, { product, variant }] as const)));
  const perVariant = new Map<string, Partial<Record<QuestionTopic, number>>>();
  const groups = new Map<string, QuestionGroup>();
  let counted = 0;
  for (const conversation of conversations) {
    const topic = questionTopic(conversation.text, conversation.intent);
    if (!topic) continue;
    const match = matchConversation(conversation, products, byVariant);
    if (!match) continue;
    counted += 1;
    // Only an exact variant counts on that variant's row; "the sneaker in 38" counts on every colour in 38.
    for (const key of match.variantKeys) {
      const topics = perVariant.get(key) ?? {};
      topics[topic] = (topics[topic] ?? 0) + 1;
      perVariant.set(key, topics);
    }
    const options = match.options;
    const groupKey = `${match.product.productKey}|${JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)))}`;
    const group = groups.get(groupKey) ?? { productKey: match.product.productKey, productTitle: match.product.productTitle, options, variantKeys: [], count: 0, topics: {}, topTopic: topic };
    group.count += 1;
    group.topics[topic] = (group.topics[topic] ?? 0) + 1;
    group.variantKeys = [...new Set([...group.variantKeys, ...match.variantKeys])];
    groups.set(groupKey, group);
  }
  const byVariantOut: Record<string, QuestionCounts> = {};
  for (const [key, topics] of perVariant) {
    byVariantOut[key] = { total: Object.values(topics).reduce((sum, value) => sum + (value ?? 0), 0), topics, topTopic: topTopic(topics) };
  }
  return {
    conversations: counted,
    byVariant: byVariantOut,
    groups: [...groups.values()]
      .map((group) => ({ ...group, topTopic: topTopic(group.topics) }))
      .sort((a, b) => b.count - a.count || a.productTitle.localeCompare(b.productTitle))
      .slice(0, limit),
  };
}

// ── What to do with it ──────────────────────────────────────────────────────

type Language = "nl" | "en";

const TOPIC_LABELS: Record<QuestionTopic, [string, string]> = {
  size: ["maat en pasvorm", "size and fit"],
  availability: ["wanneer hij weer binnen is", "when it is back in stock"],
  quality: ["kwaliteit of schade", "quality or damage"],
  return: ["retour of ruilen", "returns or exchanges"],
  colour: ["de kleur", "the colour"],
  product: ["het product", "the product"],
};

export function questionTopicLabel(topic: QuestionTopic, language: Language) {
  return TOPIC_LABELS[topic][language === "nl" ? 0 : 1];
}

export function questionGroupLabel(group: Pick<QuestionGroup, "productTitle" | "options">) {
  const options = Object.values(group.options);
  return options.length ? `${group.productTitle} · ${options.join(" / ")}` : group.productTitle;
}

/**
 * One sentence per group with what it means for buying. Questions about stock
 * on a variant that is low or sold out are the strongest signal there is:
 * people want it and cannot get it.
 */
export function questionInsight(group: QuestionGroup, statuses: Map<string, VariantStatus>, language: Language) {
  const nl = language === "nl";
  const label = questionGroupLabel(group);
  const asked = group.topics[group.topTopic] ?? group.count;
  const people = nl ? `${asked} ${asked === 1 ? "klant vroeg" : "klanten vroegen"}` : `${asked} ${asked === 1 ? "customer asked" : "customers asked"}`;
  const short = group.variantKeys.some((key) => ["out_of_stock", "low"].includes(statuses.get(key) ?? ""));
  switch (group.topTopic) {
    case "availability":
      return short
        ? (nl ? `${people} wanneer ${label} weer binnen is, en hij is (bijna) op. Bijbestellen loont hier.` : `${people} when ${label} is back, and it is (nearly) sold out. Reordering pays off here.`)
        : (nl ? `${people} of ${label} op voorraad is. Zet de levertijd duidelijk op de productpagina.` : `${people} whether ${label} is in stock. Show the delivery time clearly on the product page.`);
    case "size":
      return nl ? `${people} over maat en pasvorm van ${label}. Een maattip op de productpagina scheelt vragen en retouren.` : `${people} about size and fit of ${label}. A size tip on the product page saves questions and returns.`;
    case "quality":
      return nl ? `${people} over kwaliteit of schade bij ${label}. Bespreek het met je leverancier voor je bijbestelt.` : `${people} about quality or damage with ${label}. Raise it with your supplier before reordering.`;
    case "return":
      return nl ? `${people} over retour of ruilen van ${label}. Kijk of de beschrijving of de foto's kloppen.` : `${people} about returning or exchanging ${label}. Check that the description and photos are right.`;
    case "colour":
      return nl ? `${people} over de kleur van ${label}. Controleer of de foto's de kleur goed laten zien.` : `${people} about the colour of ${label}. Check that the photos show the colour well.`;
    default:
      return nl ? `${people} over ${label}.` : `${people} about ${label}.`;
  }
}
