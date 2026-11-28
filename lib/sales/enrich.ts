import { countProductUrls, extractSignals, isChallengePage, productSitemaps, robotsAllows, type LeadSignals } from "./leadsCore.ts";

/**
 * Haalt een handvol openbare pagina's van de eigen site van een webshop op
 * (homepage, contact, sitemap) en maakt er signalen van. Geen bol.com, geen
 * LinkedIn: die scrapen we niet. Respecteert een volledige blokkade in robots.txt.
 */

const UA = "Mozilla/5.0 (compatible; SequenceFlowLeadBot/1.0; +https://www.sequenceflow.io)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;

async function get(url: string): Promise<{ ok: boolean; status: number; text: string; url: string }> {
  try {
    const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xml;q=0.9,*/*;q=0.5", "Accept-Language": "nl-NL,nl;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = (await response.text()).slice(0, MAX_BYTES);
    return { ok: response.ok, status: response.status, text, url: response.url || url };
  } catch {
    return { ok: false, status: 0, text: "", url };
  }
}

export type Enriched = { ok: true; domain: string; website: string; signals: LeadSignals } | { ok: false; domain: string; reason: string };

export async function enrichDomain(domain: string): Promise<Enriched> {
  const base = `https://${domain}`;
  const robots = await get(`${base}/robots.txt`);
  if (robots.ok && !robotsAllows(robots.text)) return { ok: false, domain, reason: "robots.txt blokkeert bots" };

  const home = await get(base);
  if (!home.ok || !home.text) return { ok: false, domain, reason: home.status ? `homepage gaf ${home.status}` : "homepage niet bereikbaar" };
  if (isChallengePage(home.text)) return { ok: false, domain, reason: "site toont een botcontrole (captcha); bekijk hem zelf" };
  const website = new URL(home.url).origin;

  // Contact-, FAQ- en retourpagina's: daar staan het algemene adres, KvK en het beleid.
  const links = [...home.text.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  const wanted = links
    .filter((href) => /(contact|klantenservice|customer-service|faq|veelgestelde|retour|over-ons|about)/i.test(href))
    .map((href) => { try { return new URL(href, website).toString(); } catch { return null; } })
    .filter((href): href is string => Boolean(href) && new URL(href!).hostname.replace(/^www\./, "") === domain);
  const extraPages = [...new Set(wanted)].slice(0, 3);
  if (!extraPages.length) extraPages.push(`${website}/contact`);
  const pages = await Promise.all(extraPages.map((url) => get(url)));

  // Productaantal uit de sitemap (Shopify zet producten in een eigen sub-sitemap).
  let productCount: number | null = null;
  const sitemap = await get(`${website}/sitemap.xml`);
  if (sitemap.ok && sitemap.text.includes("<loc>")) {
    const subs = productSitemaps(sitemap.text);
    if (subs.length) {
      const parts = await Promise.all(subs.map((url) => get(url)));
      productCount = parts.reduce((sum, part) => sum + (part.ok ? countProductUrls(part.text) : 0), 0) || null;
    } else {
      productCount = countProductUrls(sitemap.text) || null;
    }
  }

  const html = [home.text, ...pages.filter((p) => p.ok).map((p) => p.text)].join("\n");
  return { ok: true, domain, website, signals: extractSignals(html, domain, productCount) };
}
