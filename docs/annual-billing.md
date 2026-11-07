# Jaarbetaling — 7 november 2026

Bezig: Codex (`codex/annual-billing`). Afgesproken: 20% korting op twaalf basismaanden, jaarlijks vooraf. Bestaande maandabonnementen worden niet automatisch gemigreerd.

| Pakket | Per maand | Per jaar vooraf | Maandgemiddelde bij jaarbetaling |
|---|---:|---:|---:|
| Starter | €47 | €451,20 | €37,60 |
| Growth | €147 | €1.411,20 | €117,60 |
| Scale | €297 | €2.851,20 | €237,60 |

Exclusief btw. Bundels blijven 100/400/1.000 gesprekken **per maand**; conceptlimieten en features blijven gelijk. Extra gebruik wordt maandelijks afgerekend tegen €0,47/€0,97. Geen korting op gebruik of eenmalige inrichting.

## Uitvoering

- NL/EN-prijskaarten, rekenhulp, app-instellingen, upgradepagina en upgradevenster hebben maand/jaar. Kaarten en rekenhulp delen de periodekeuze. Jaarbedrag vooraf staat zichtbaar onder het maandgemiddelde.
- Marketinglinks nemen de periode mee via de bestaande `next`-route na login naar instellingen.
- Stripe Checkout maakt uitsluitend de jaarlijkse basisregel aan, met flexible billing. Na betaalde checkout voegt de webhook beide maandelijkse gemeten gebruiksregels idempotent toe aan hetzelfde abonnement. Stripe Checkout ondersteunt nog geen mixed intervals direct.
- Webhooks herkennen jaarprijs-IDs als dezelfde tiers; maandelijkse gebruiksfacturen zoeken de basisregel in het abonnement. Gebruiksvensters blijven maandelijks vernieuwen via `currentUsagePeriodStart`, ook bij een jaarlijkse basisregel.
- Wisselen via de app verandert alleen de basisregel en factureert naar rato. Bij een benodigde betaling blijft de bestaande configuratie staan totdat betaling lukt (`pending_if_incomplete`). Jaarlijks overstappen migreert classic billing eerst naar flexible.

## Stripe: aangemaakt en productievariabelen ingesteld

- `STRIPE_PRICE_STARTER_ANNUAL`: `price_1UZChQR9iinnBUvVN1R8xIAF`
- `STRIPE_PRICE_PRO_ANNUAL`: `price_1UZChRR9iinnBUvVGthH4zXL`
- `STRIPE_PRICE_AGENCY_ANNUAL`: `price_1UZChRR9iinnBUvV4VlmtVaA`

Deze toevoegingen wijzigen geen lopende contracten. De websitewijzigingen zijn nog niet naar main gepubliceerd.

## Shopify: concrete beperking

De huidige Shopify App Pricing-route ondersteunt geen jaarplan gecombineerd met gebruiksmeters. Daarom blijft Shopify maandelijks; de website vermeldt dit expliciet. Geen unsupported jaarhandles toegevoegd, geen meters verwijderd en geen Shopify-klanten naar Stripe omgeleid.

Bron: https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing/subscription-billing/combined-subscription-and-usage
Stripe: https://docs.stripe.com/billing/subscriptions/mixed-interval?dashboard-or-api=api

## Controle en resterende releasecontrole

- Rekensom, mapping van jaarprijzen naar tiers en maandelijkse bundelvernieuwing zijn getest.
- Browser: jaarbedragen, gedeelde periodekeuze van kaartjes/rekenhulp en loginlinks gecontroleerd.
- Alle drie live Stripe-checkouts aangemaakt zonder klant of betaling, bedragen gecontroleerd en sessies direct verlopen gemaakt. Niemand is belast.
- Een echte betaalde jaarcheckout inclusief de opvolgende maandelijkse gebruiksfactuur is nog niet end-to-end doorlopen. Dit is een releasecontrole, geen reeds bewezen betaalflow. Een sandbox/testmode met gekoppelde testmeters heeft de voorkeur vóór uitrollen.
