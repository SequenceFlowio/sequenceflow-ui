import assert from "node:assert/strict";
import test from "node:test";

import { clampLinkedin, draftFacts, LINKEDIN_MAX } from "../lib/sales/drafts.ts";
import { countProductUrls, detectPlatform, extractSignals, normalizeDomain, pickGenericEmail, productSitemaps, robotsAllows, scoreLead } from "../lib/sales/leadsCore.ts";
import { addWorkdays } from "../lib/sales/store.ts";

test("domeinen normaliseren, marktplaatsen en social overslaan", () => {
  assert.equal(normalizeDomain("https://www.Voorbeeldwinkel.nl/collections/x?y=1"), "voorbeeldwinkel.nl");
  assert.equal(normalizeDomain("testshop.nl"), "testshop.nl");
  assert.equal(normalizeDomain("https://www.bol.com/nl/nl/v/winkel/123/"), null);
  assert.equal(normalizeDomain("instagram.com/shop"), null);
  assert.equal(normalizeDomain("geen domein"), null);
});

test("platform herkennen", () => {
  assert.equal(detectPlatform('<script src="https://cdn.shopify.com/s/files/x.js">'), "shopify");
  assert.equal(detectPlatform('<link href="/wp-content/plugins/woocommerce/x.css">'), "woocommerce");
  assert.equal(detectPlatform('<img src="https://cdn.webshopapp.com/x.png">'), "lightspeed");
  assert.equal(detectPlatform("<html></html>"), "onbekend");
});

test("alleen algemene adressen op het eigen domein", () => {
  const html = 'Mail <a href="mailto:jan@winkel.nl">Jan</a>, <a href="mailto:info@winkel.nl">info</a> of klantenservice@winkel.nl, niet winkel@gmail.com';
  assert.equal(pickGenericEmail(html, "winkel.nl"), "klantenservice@winkel.nl");
  assert.equal(pickGenericEmail('mailto:jan@winkel.nl', "winkel.nl"), null);
  assert.equal(pickGenericEmail('logo@2x.png info@winkel.nl', "winkel.nl"), "info@winkel.nl");
});

const shopHtml = `<html lang="nl-NL"><title>Voorbeeldwinkel | Duurzame keukenspullen</title>
<script src="https://cdn.shopify.com/a.js"></script>
<a href="https://www.bol.com/nl/nl/v/voorbeeldwinkel/1234567/">Ook op bol</a>
<a href="/pages/faq">FAQ</a> <a href="/pages/retourneren">Retour</a>
<a href="https://www.linkedin.com/company/voorbeeldwinkel">LinkedIn</a>
KvK: 12345678 · info@voorbeeldwinkel.nl · Kiyoh 1.234 beoordelingen · winkelwagen bezorging</html>`;

test("signalen uit een Shopify-shop met bol-winkel", () => {
  const s = extractSignals(shopHtml, "voorbeeldwinkel.nl", 640);
  assert.equal(s.platform, "shopify");
  assert.equal(s.bol, true);
  assert.match(s.bolUrl ?? "", /bol\.com\/nl\/nl\/v\/voorbeeldwinkel/);
  assert.equal(s.dutch, true);
  assert.equal(s.contactEmail, "info@voorbeeldwinkel.nl");
  assert.equal(s.linkedinUrl, "https://www.linkedin.com/company/voorbeeldwinkel");
  assert.equal(s.kvk, "12345678");
  assert.deepEqual(s.trust, ["Kiyoh"]);
  assert.equal(s.reviewCount, 1234);
  assert.deepEqual(s.helpdesk, []);
  assert.equal(s.hasFaq && s.hasReturnsPage, true);
  assert.equal(s.title, "Voorbeeldwinkel | Duurzame keukenspullen");
});

test("score: bol + eigen shop + zelf support scoort hoog, met redenen", () => {
  const strong = scoreLead(extractSignals(shopHtml, "voorbeeldwinkel.nl", 640));
  assert.ok(strong.score >= 85, `score ${strong.score}`);
  assert.ok(strong.reasons.some((r) => r.includes("bol")));
  const withHelpdesk = scoreLead(extractSignals(`${shopHtml}<script src="https://config.gorgias.chat/x.js">`, "voorbeeldwinkel.nl", 640));
  assert.equal(withHelpdesk.score, strong.score - 20);
  const weak = scoreLead(extractSignals("<html lang='en'><title>Shop</title></html>", "shop.com", 10));
  assert.ok(weak.score <= 20, `score ${weak.score}`);
});

test("sitemaps: productpagina's tellen", () => {
  const index = "<sitemapindex><sitemap><loc>https://x.nl/sitemap_products_1.xml?from=1</loc></sitemap><sitemap><loc>https://x.nl/sitemap_pages_1.xml</loc></sitemap></sitemapindex>";
  assert.deepEqual(productSitemaps(index), ["https://x.nl/sitemap_products_1.xml?from=1"]);
  const products = "<urlset><url><loc>https://x.nl/products/a</loc><image:loc>https://cdn/x.jpg</image:loc></url><url><loc>https://x.nl/products/b</loc></url><url><loc>https://x.nl/pages/over</loc></url></urlset>";
  assert.equal(countProductUrls(products), 2);
});

test("robots.txt: alleen een volledige blokkade houdt ons tegen", () => {
  assert.equal(robotsAllows("User-agent: *\nDisallow: /checkout"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /"), false);
  assert.equal(robotsAllows("User-agent: SequenceFlowLeadBot\nDisallow: /\n\nUser-agent: *\nDisallow:"), false);
  assert.equal(robotsAllows("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /"), true);
});

test("concepten: LinkedIn blijft onder de limiet en feiten verzinnen niets", () => {
  const long = "Zin een. ".repeat(60);
  assert.ok(clampLinkedin(long).length <= LINKEDIN_MAX);
  assert.equal(clampLinkedin("Kort bericht."), "Kort bericht.");
  const facts = draftFacts({ name: "Voorbeeldwinkel", domain: "voorbeeldwinkel.nl", category: null, signals: extractSignals(shopHtml, "voorbeeldwinkel.nl", 640) });
  assert.match(facts, /bol/);
  assert.match(facts, /shopify/);
  assert.doesNotMatch(facts, /12345678/); // KvK hoort niet in een bericht
});

test("opvolgen over werkdagen slaat het weekend over", () => {
  // vrijdag 27 nov 2026 + 4 werkdagen = donderdag 3 dec
  assert.equal(addWorkdays(new Date("2026-11-27T10:00:00Z"), 4).toISOString().slice(0, 10), "2026-12-03");
});
