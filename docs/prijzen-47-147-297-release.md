# Prijswijziging — 7 november 2026

Branch: `codex/prices-47-147-297`. Nog niet gemerged naar main.

- Direct/Stripe: EUR 47 / 147 / 297 per maand; extra gesprekken EUR 0,47 gecontroleerd / 0,97 zelfstandig.
- Shopify App Pricing: USD 47 / 147 / 297; extra gesprekken USD 0,47 / 0,97. Alle drie opgeslagen en gecontroleerd in Partner Dashboard. Bestaande contracten niet gemigreerd.
- Bundels blijven 100 / 400 / 1.000. De twee soorten afhandeling delen één bundel.
- Shopify ondersteunt alleen USD in deze beheerde prijsroute. Website en embedded app vermelden het verschil en eventuele conversie.
- Stripe: vijf nieuwe live-catalogusprijzen aangemaakt; de oude blijven bestaan voor lopende contracten. Legacy prijs-ID's blijven herkenbaar in de webhook.
- Vercel: nieuwe prijs-ID's alleen op de previewbranch. Productie behoudt oude ID's totdat de code naar main gaat, zodat een andere bouwer geen onbedoelde prijswijziging publiceert.

## Bij publicatie

Na goedkeuring fetch/rebase, code naar main en tegelijk onderstaande productievariabelen instellen. Geen bestaande subscriptions aanpassen.

```
STRIPE_PRICE_STARTER=price_1UZ9lXR9iinnBUvVaNTQ3BUj
STRIPE_PRICE_PRO=price_1UZ9lYR9iinnBUvV5J6tokJV
STRIPE_PRICE_AGENCY=price_1UZ9lYR9iinnBUvVswGzJaJr
STRIPE_PRICE_HANDLED_ASSISTED=price_1UZ9lZR9iinnBUvVRgYANVBg
STRIPE_PRICE_HANDLED_AUTONOMOUS=price_1UZ9lZR9iinnBUvV5NbIPIwA
```

Deze prijs-ID's zijn geen secrets. Bewaar `STRIPE_PRICE_*_LEGACY` voor bestaande abonnementen.

Documentatie: https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing#limitations

Validatie: 422 tests geslaagd; productiebuild met pricing-v2 actief geslaagd; gerichte lint geen fouten (bestaande effect-warning in EmbeddedSupport).
