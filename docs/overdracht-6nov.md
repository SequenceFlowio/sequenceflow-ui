# Overdracht 6 november 2026 (Claude → Codex)

Kort wat er sinds 5 nov is veranderd, zodat je niet dubbel bouwt. Alles staat op main (PR #47–#77).

## Prijzen (live)
- Starter €49 / Growth €149 / Scale €299, met 100 / 400 / 1.000 **afgehandelde gesprekken inbegrepen**; daarboven €0,49 (gecontroleerd) of €0,99 (zelfstandig). Conceptgrenzen 500 / 2.000 / 6.000. Automatisch versturen in elk betaald pakket; Pijnpunten vanaf Growth; Voorraad/Otis alleen Scale.
- Eén bron: `lib/planCatalog.ts` (`PLAN_CATALOG_V2`, `INCLUDED_HANDLED`) + `HANDLED_PRICING.includedPerPeriod` in `lib/billing/handledConversations.ts` (een test bewaakt dat ze gelijk zijn).
- Vercel: `NEXT_PUBLIC_PRICING_V2=on`, `STRIPE_USAGE_BILLING=on`, nieuwe `STRIPE_PRICE_*`. Oude Stripe-prijzen (€79/€229/€549) gearchiveerd.
- Teller: `app/api/cron/handled-usage` (elk uur). Register `billing_handled_conversations` met status `included | pending_report | reported | over_budget | not_billed` (migratie 069). Een kort bedankje van de klant laat de telling niet vervallen (`isThanksOnly`).
- **Shopify:** plannen in het Partner-dashboard op $49/$149/$299, 14 dagen proef, meters `handled_assisted` ($0,49) en `handled_autonomous` ($0,99). De cron meldt afgerekende gesprekken via de App Events API (`lib/shopify/appEvents.ts`). Nog te bevestigen dat het token-recht `write_global_api_app_events` aanstaat.

## Nieuw in de app
- `/pijnpunten`: eigen pagina in de navigatie (blok was sinds juli weg uit Analytics).
- Overzicht: "wat Support One deze maand opleverde" (`/api/analytics/value`) en vertraagde zendingen (`/api/commerce/delays`, `lib/commerce/delays.ts`).
- Maandagmail van Seffy: `/api/cron/weekly-briefing`, afmelden via ondertekende link (`tenants.weekly_briefing_enabled`, migratie 070).
- `/intern`: intern dashboard (kosten, MRR, marge per klant, trechter), alleen voor `PLATFORM_ADMIN_EMAILS`.
- Alle AI-aanroepen loggen kosten in `ai_usage_events` via `logAiCost` (status `waived`, geen credits voor de klant).
- gpt-4.1-nano draait stil mee bij de spamcheck (25%) → `ai_shadow_runs` (migratie 071). Uit: `AI_SHADOW_NANO=off`.
- "Wat is nieuw" in de zijbalk (`lib/whatsNew.ts`). Vera heet Otis.

## Site
- Overal dezelfde navigatie (`SiteNavigation`; `MarketingHeader` geeft die nu altijd terug). Overal "je", nooit "u".
- Engelse site: `/en`, `/en/pricing` (prijzen nog in euro). Sectie 07 Pijnpunten op de supportsite. Chat heet Seffy (support) / Juno (content).
- Ontwerp Content One op `/design/content-one` wacht op akkoord; `/content` is ongewijzigd.

## Inloggen
- Eerste keer inloggen gaf soms "PKCE code verifier not found". Nu: één automatische herstart (`retry=1`) en het oude adres `emailreply.sequenceflow.io` telt nooit meer als app-adres (`configuredAppOrigin`, `/auth/start`). `NEXT_PUBLIC_APP_URL` in Vercel wijst nog naar emailreply; de code vangt dat op.

## Open / wacht op Navaron
Zie `docs/plan-prijzen-en-mascotte-vervolg.md` §11. Belangrijkste: live aankoop testen met een proefaccount, website fase C (support → www doorsturen), roadmap #3 (acties met geld), dollarprijzen, eigen SequenceFlow-werkruimte voor de assistent, Outlook (Azure).
