/**
 * Leadmachine, het rekenwerk: van de openbare pagina's van een webshop naar
 * signalen en een score. Geen netwerk, geen database, geen imports met een
 * alias, zodat het los te testen en vanuit een script te draaien is.
 *
 * Wat we bewaren is alleen bedrijfsinformatie: platform, bol-winkel, een
 * algemeen contactadres, keurmerken, omvang. Persoonlijke e-mailadressen
 * (voornaam@...) slaan we nooit op.
 */

export const LEAD_STATUSES = ["nieuw", "goedgekeurd", "benaderd", "gereageerd", "demo", "trial", "klant", "afgewezen", "afgemeld"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  nieuw: "Nieuw", goedgekeurd: "Klaar om te benaderen", benaderd: "Benaderd", gereageerd: "Gereageerd", demo: "Demo gepland",
  trial: "In proefperiode", klant: "Klant", afgewezen: "Geen match", afgemeld: "Afgemeld",
};

export type Platform = "shopify" | "woocommerce" | "lightspeed" | "magento" | "ccv" | "shopware" | "prestashop" | "mijnwebwinkel" | "wix" | "onbekend";

export type LeadSignals = {
  platform: Platform;
  /** Noemt de site bol (link naar een bol-winkel, "ook bij bol", partnerlogo). */
  bol: boolean;
  bolUrl: string | null;
  dutch: boolean;
  contactEmail: string | null;
  linkedinUrl: string | null;
  kvk: string | null;
  /** Keurmerken en reviewwidgets op de site. */
  trust: string[];
  reviewCount: number | null;
  productCount: number | null;
  /** Helpdesk- of chattools die al op de site staan. */
  helpdesk: string[];
  hasFaq: boolean;
  hasReturnsPage: boolean;
  title: string | null;
};

/** "https://www.Shop.nl/pad?x" → "shop.nl". Null als het geen bruikbaar domein is. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
    if (/(^|\.)(bol\.com|amazon\.|facebook\.com|instagram\.com|linkedin\.com|google\.|youtube\.com|tiktok\.com|marktplaats\.nl)/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function detectPlatform(html: string): Platform {
  const h = html.toLowerCase();
  if (h.includes("cdn.shopify.com") || h.includes("shopify.theme") || h.includes("myshopify.com")) return "shopify";
  if (h.includes("woocommerce") || h.includes("wc-block") || h.includes("/wp-content/plugins/woocommerce")) return "woocommerce";
  if (h.includes("lightspeed") || h.includes("webshopapp.com") || h.includes("seoshop")) return "lightspeed";
  if (h.includes("mage/cookies") || h.includes("magento") || h.includes("/static/version")) return "magento";
  if (h.includes("ccvshop") || h.includes("ccv shop")) return "ccv";
  if (h.includes("shopware")) return "shopware";
  if (h.includes("prestashop")) return "prestashop";
  if (h.includes("mijnwebwinkel") || h.includes("mijnwebwinkel.nl")) return "mijnwebwinkel";
  if (h.includes("wixstatic.com") || h.includes("wix.com")) return "wix";
  return "onbekend";
}

const GENERIC_LOCAL = /^(info|klantenservice|service|support|hallo|hello|hi|contact|sales|webshop|shop|winkel|bestellingen|orders|vragen|team|mail|office|administratie|customerservice|care)$/;

/** Alleen algemene adressen op het eigen domein; voornaam@ of gmail-adressen niet. */
export function pickGenericEmail(html: string, domain: string): string | null {
  const found = new Set<string>();
  for (const match of html.matchAll(/(?:mailto:)?([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    const local = match[1].toLowerCase();
    const host = match[2].toLowerCase().replace(/^www\./, "");
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(host)) continue;
    if (host !== domain && !host.endsWith(`.${domain}`)) continue;
    if (GENERIC_LOCAL.test(local)) found.add(`${local}@${host}`);
  }
  const order = ["klantenservice", "service", "support", "info", "hallo", "contact"];
  return [...found].sort((a, b) => {
    const ia = order.findIndex((p) => a.startsWith(`${p}@`));
    const ib = order.findIndex((p) => b.startsWith(`${p}@`));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  })[0] ?? null;
}

const TRUST: Array<[string, RegExp]> = [
  ["Thuiswinkel Waarborg", /thuiswinkel/i],
  ["WebwinkelKeur", /webwinkelkeur/i],
  ["Kiyoh", /kiyoh/i],
  ["Trustpilot", /trustpilot/i],
  ["Trusted Shops", /trustedshops|trusted shops/i],
  ["Feedback Company", /feedbackcompany/i],
];

const HELPDESK: Array<[string, RegExp]> = [
  ["Gorgias", /gorgias/i],
  ["Zendesk", /zendesk|zdassets/i],
  ["Trengo", /trengo/i],
  ["Freshdesk", /freshdesk|freshchat/i],
  ["Intercom", /intercom/i],
  ["Tidio", /tidio/i],
  ["LiveChat", /livechatinc/i],
  ["Richpanel", /richpanel/i],
  ["Reamaze", /reamaze/i],
];

function firstNumber(text: string | undefined) {
  if (!text) return null;
  const value = Number(text.replace(/[.\s]/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Signalen uit de html van de homepage en eventueel contact-, FAQ- en retourpagina's (samengevoegd). */
export function extractSignals(html: string, domain: string, productCount: number | null = null): LeadSignals {
  const bolLink = html.match(/https?:\/\/(?:www\.)?bol\.com\/nl\/nl\/(?:v|s)\/[^"'\s<>]+/i)?.[0] ?? null;
  const bol = Boolean(bolLink) || /\b(ook (verkrijgbaar|te koop) (bij|via|op) bol|bol(\.com)? partner|verkoop(t|punt)? (via|op) bol|bol\.com)\b/i.test(html);
  const linkedin = html.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[a-z0-9_%-]+/i)?.[0] ?? null;
  const kvk = html.match(/\bk\.?v\.?k\.?(?:[- ]?(?:nummer|nr\.?))?[:\s]*([0-9]{8})\b/i)?.[1] ?? null;
  const reviews = html.match(/([0-9][0-9.\s]{0,8})\s*(?:reviews|beoordelingen|recensies)/i)?.[1];
  const lang = html.match(/<html[^>]*\blang=["']?([a-z-]+)/i)?.[1]?.toLowerCase() ?? "";
  const dutchWords = (html.match(/\b(winkelwagen|bezorging|verzending|retourneren|klantenservice|bestellen|levertijd|gratis verzending)\b/gi) ?? []).length;
  const title = html.match(/<title[^>]*>([^<]{1,160})<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  return {
    platform: detectPlatform(html),
    bol,
    bolUrl: bolLink,
    dutch: lang.startsWith("nl") || dutchWords >= 3,
    contactEmail: pickGenericEmail(html, domain),
    linkedinUrl: linkedin,
    kvk,
    trust: TRUST.filter(([, re]) => re.test(html)).map(([name]) => name),
    reviewCount: firstNumber(reviews),
    productCount,
    helpdesk: HELPDESK.filter(([, re]) => re.test(html)).map(([name]) => name),
    hasFaq: /href=["'][^"']*(faq|veelgestelde)/i.test(html),
    hasReturnsPage: /href=["'][^"']*(retour|return)/i.test(html),
    title: title ? decodeEntities(title) : null,
  };
}

function decodeEntities(text: string) {
  return text.replace(/&amp;/g, "&").replace(/&#039;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&ndash;|&#8211;/g, "–").replace(/&nbsp;/g, " ");
}

const SUPPORTED: Platform[] = ["shopify", "woocommerce", "lightspeed"];

/**
 * Score 0–100 voor de primaire doelgroep van het plan: NL-webshop die op bol én in een
 * eigen shop verkoopt, groot genoeg voor veel klantmail (20–200 orders/dag), die
 * support nog zelf doet. Elke punt krijgt een reden, zodat de score uit te leggen is.
 */
export function scoreLead(signals: LeadSignals): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => { score += points; reasons.push(`${points > 0 ? "+" : ""}${points} ${reason}`); };

  if (signals.bol) add(30, signals.bolUrl ? "verkoopt op bol (link naar bol-winkel)" : "noemt bol op de site");
  if (signals.dutch) add(10, "Nederlandse shop");
  if (SUPPORTED.includes(signals.platform)) add(15, `draait op ${signals.platform} (koppeling bestaat)`);
  else if (signals.platform !== "onbekend") add(5, `draait op ${signals.platform}`);

  const products = signals.productCount;
  if (products !== null) {
    if (products >= 100 && products <= 5000) add(15, `${products} producten: genoeg volume voor veel vragen`);
    else if (products >= 30) add(8, `${products} producten`);
    else add(0, `pas ${products} producten`);
  }
  const reviewsCount = signals.reviewCount;
  if (reviewsCount !== null && reviewsCount >= 500) add(10, `${reviewsCount} reviews: veel orders`);
  else if (reviewsCount !== null && reviewsCount >= 100) add(5, `${reviewsCount} reviews`);
  if (signals.trust.length) add(5, `keurmerk/reviews: ${signals.trust.join(", ")}`);

  if (signals.helpdesk.length) add(-10, `heeft al ${signals.helpdesk.join(", ")}`);
  else add(10, "geen helpdesk-tool gezien: doet support waarschijnlijk zelf in de mailbox");

  if (signals.contactEmail) add(5, "algemeen contactadres gevonden");
  if (signals.hasFaq && signals.hasReturnsPage) add(0, "heeft FAQ en retourpagina (bron voor de kennisbank)");

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/** Aantal product-url's in een (Shopify-, WooCommerce- of algemene) sitemap. */
export function countProductUrls(xml: string) {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]);
  return locs.filter((loc) => /\/(products?|product-[^/]+|p)\/|\.html$/i.test(loc) && !/sitemap/i.test(loc)).length;
}

/** Sub-sitemaps met producten in een sitemap-index. */
export function productSitemaps(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]).filter((loc) => /sitemap/i.test(loc) && /product/i.test(loc)).slice(0, 4);
}

/** Mag onze bot de homepage ophalen volgens robots.txt? Alleen een volledige blokkade telt. */
export function robotsAllows(robots: string, agent = "sequenceflowleadbot") {
  const groups: Array<{ agents: string[]; disallowAll: boolean }> = [];
  let current: { agents: string[]; disallowAll: boolean } | null = null;
  let lastWasAgent = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (!key) continue;
    if (/^user-agent$/i.test(key)) {
      if (!current || !lastWasAgent) { current = { agents: [], disallowAll: false }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && /^disallow$/i.test(key) && value === "/") current.disallowAll = true;
    }
  }
  const own = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const any = groups.find((g) => g.agents.includes("*"));
  return !(own ?? any)?.disallowAll;
}

/** Cloudflare-, captcha- of "human verification"-pagina in plaats van de echte site. */
export function isChallengePage(html: string) {
  const head = html.slice(0, 20000);
  return /just a moment\.\.\.|cf-challenge|challenge-platform|human verification|verify you are human|are you a robot|captcha-delivery|px-captcha|ddos-guard/i.test(head) && html.length < 60000;
}
