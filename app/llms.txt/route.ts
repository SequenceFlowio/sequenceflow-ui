import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { PRODUCTS } from "@/lib/marketing/products";
import { SITE_ORIGIN } from "@/lib/site";
import { PLAN_LIMITS } from "@/lib/billingPlans";
import { formatCount, PAID_PLAN_CATALOG, planPriceSummary } from "@/lib/planCatalog";

const listNl = (items: string[]) => `${items.slice(0, -1).join(", ")} en ${items.at(-1)}`;

/**
 * /llms.txt (llmstxt.org): een korte, actuele samenvatting voor AI-assistenten
 * en AI-zoekmachines. De oude site beschreef "Flow-as-a-Service" voor het MKB;
 * het laatste blok zegt daarom expliciet wat er van die namen geworden is.
 * Houd dit in lijn met lib/marketing/siteChat.ts.
 */

export const dynamic = "force-static";

const support = PRODUCTS.support.name;

const BODY = `# SequenceFlow

> SequenceFlow bouwt AI-agents voor e-commerce ondernemers. ${support} is een AI-team voor support en voorraad: Seffy beantwoordt klantmails, Otis houdt de voorraad in de gaten. Nederlands bedrijf, gericht op webshops op onder meer Shopify, WooCommerce en bol.

## Producten

- [${support}](${SITE_ORIGIN}/support-one): AI-klantenservice en voorraadadvies, nu beschikbaar. Seffy (klantmail): maakt antwoordconcepten voor klantmails op basis van het eigen beleid en de kennis van de webshop; menselijke goedkeuring is standaard, automatisch versturen is optioneel. Werkt met de bestaande supportmailbox (forwarding of IMAP, versturen via SMTP). Bestelcontext uit bol; Shopify in pilot, WooCommerce volgt. Inzicht in volume en terugkerende vragen. Otis (voorraad en inkoop, in Scale): inkoopadvies per variant op basis van verkoop, voorraad en levertijd, klantvragen per variant uit de supportinbox, een wachtlijst voor "weer op voorraad", meldingen en een concept-inkooporder; niets verandert zonder bevestiging. 14 dagen gratis, zonder creditcard. Inloggen en de app: ${DEFAULT_APP_ORIGIN}

## Prijzen

- [Prijzen ${support}](${SITE_ORIGIN}/pricing): ${planPriceSummary()} per maand, met ${listNl(PAID_PLAN_CATALOG.map((plan) => formatCount(PLAN_LIMITS[plan.id].aiAnswers)))} antwoordconcepten per maand. Spam telt niet mee.

## Meer

- [Blog](${SITE_ORIGIN}/blog): artikelen over AI-klantenservice en e-commerce
- [Contact](${SITE_ORIGIN}/contact): hallo@sequenceflow.io, of plan een kennismaking
- [AI- en data-ethiek](${SITE_ORIGIN}/ai-data-ethiek): mailinhoud wordt niet gebruikt om AI-modellen te trainen
- [Privacyverklaring](${SITE_ORIGIN}/privacyverklaring)

## Oude namen

SequenceFlow bood eerder maatwerk-workflows aan onder de naam "Flow-as-a-Service" (Lead Flow, Support Flow, Operations Flow) voor het MKB, met een setup fee en abonnement. Dat aanbod bestaat niet meer.

- "Email Reply" en "Support Flow" heten nu ${support}.
- "Content Gen" (social content) is in ontwikkeling en nog niet beschikbaar.
- "Lead Flow", "Operations Flow" en de losse flow-modules worden niet meer aangeboden.
`;

export function GET() {
  return new Response(BODY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
