import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { PRODUCTS } from "@/lib/marketing/products";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * /llms.txt (llmstxt.org): een korte, actuele samenvatting voor AI-assistenten
 * en AI-zoekmachines. De oude site beschreef "Flow-as-a-Service" voor het MKB;
 * het laatste blok zegt daarom expliciet wat er van die namen geworden is.
 * Houd dit in lijn met lib/marketing/siteChat.ts.
 */

export const dynamic = "force-static";

const support = PRODUCTS.support.name;
const content = PRODUCTS.content.name;

const BODY = `# SequenceFlow

> SequenceFlow bouwt AI-agents voor e-commerce ondernemers: ${support} voor klantenservice en webshopinzicht, en ${content} voor social content die producten verkoopt. Nederlands bedrijf, gericht op webshops op onder meer Shopify, WooCommerce en bol.

## Producten

- [${support}](${DEFAULT_APP_ORIGIN}/): AI-klantenservice, nu beschikbaar. Maakt antwoordconcepten voor klantmails op basis van het eigen beleid en de kennis van de webshop; menselijke goedkeuring is standaard, automatisch versturen is optioneel. Werkt met de bestaande supportmailbox (forwarding of IMAP, versturen via SMTP). Bestelcontext uit bol; Shopify in pilot, WooCommerce volgt. Inzicht in volume en terugkerende vragen. 14 dagen gratis, zonder creditcard.
- [${content}](${SITE_ORIGIN}/content): AI-contentgenerator, in ontwikkeling (early access). Maakt van de producten in een webshop posts, carrousels, Reel-scripts, TikTok-hooks en Pinterest-pins in de eigen merkstem, en vult een contentkalender. Alles wordt eerst goedgekeurd. Eerst voor Shopify en WooCommerce.

## Prijzen

- [Prijzen ${support}](${SITE_ORIGIN}/pricing): Starter €79, Growth €229, Scale €549 per maand, met 150, 500 en 1.500 antwoordconcepten per maand. Spam telt niet mee.
- ${content}: nog geen prijs; early access aanvragen via ${SITE_ORIGIN}/content

## Meer

- [Bedrijfspagina](${SITE_ORIGIN}/): overzicht van beide agents
- [Blog](${SITE_ORIGIN}/blog): artikelen over AI-klantenservice en e-commerce
- [Contact](${SITE_ORIGIN}/contact): hallo@sequenceflow.io, of plan een kennismaking
- [AI- en data-ethiek](${SITE_ORIGIN}/ai-data-ethiek): mailinhoud wordt niet gebruikt om AI-modellen te trainen
- [Privacyverklaring](${SITE_ORIGIN}/privacyverklaring)

## Oude namen

SequenceFlow bood eerder maatwerk-workflows aan onder de naam "Flow-as-a-Service" (Lead Flow, Support Flow, Operations Flow) voor het MKB, met een setup fee en abonnement. Dat aanbod bestaat niet meer.

- "Email Reply" en "Support Flow" heten nu ${support}.
- "Content Gen" heet nu ${content}.
- "Lead Flow", "Operations Flow" en de losse flow-modules worden niet meer aangeboden.
`;

export function GET() {
  return new Response(BODY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
