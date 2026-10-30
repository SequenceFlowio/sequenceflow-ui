# Inkoopadvies per variant

Plan: https://claude.ai/artifact/X2SFbtj3ygZJccumeEmuaC. Gebouwd op `feat/inkoopadvies` (28 okt 2026). Staat nog niet live.

## Wat het doet

- Houdt per variant (maat, kleur) de verkoop per dag en de voorraad per dag bij, voor bol.com, Shopify en WooCommerce samen. Varianten met dezelfde SKU of EAN tellen als één variant.
- Rekent per variant het tempo, de dagen voorraad, dode voorraad, het seizoen (zelfde periode vorig jaar) en hoeveel je moet bijbestellen. De rekenregels staan in `lib/inventory/core.ts`. De AI rekent niets.
- Laat dat zien op `/inventory` (Overzicht, Seizoen, Leveringen en import, Instellingen), stuurt op maandag een mail en geeft drie MCP-tools: `get_inventory_health`, `list_inventory_variants`, `get_season_sales`.
- Herkent leveringen aan sprongen in de voorraad. Leveringen en oude verkopen kun je ook invoeren of als CSV importeren.

## Klantvragen per variant

Bij elke update telt `lib/inventory/questionsCore.ts` de klantgesprekken van de laatste 90 dagen per variant, en waar ze over gaan: maat en pasvorm, wanneer iets weer binnen is, kwaliteit, kleur, retour. Vragen over de levering of betaling tellen niet.

- **Herkenning:** een gesprek telt voor een variant als de klant het product noemt (en eventueel maat of kleur), of als het gesprek aan een bestelling met dat product hangt. Er wordt niets nieuws opgeslagen: alleen de aantallen komen in het rapport, geen klanttekst.
- **Op de pagina:** een kaart "Wat klanten vragen" met wat het betekent voor de inkoop. Vragen over een variant die (bijna) op is, zijn het sterkste signaal om bij te bestellen. Bij elke variant staat het aantal vragen.
- **Ook in de mail en MCP:** de weekmail noemt de top 3, en `get_inventory_health` en `list_inventory_variants` geven de aantallen mee.

## Alleen voor Scale

Inkoopadvies hoort bij Scale (intern `agency`) en maatwerk (`custom`); zie `INVENTORY_PLANS` in `lib/billingPlans.ts`. Shopify-winkels op het Shopify-plan "scale" vallen daar ook onder.

- **Lagere pakketten en proef:** de pagina laat een uitleg met een upgradeknop zien, met daaronder een grijs voorbeeld met verzonnen cijfers (`lib/inventory/demo.ts`). In de zijbalk staat een slotje bij Voorraad.
- **API:** `/api/inventory/*` geeft `403` met `upgrade: true`.
- **Cron:** synchroniseert en mailt alleen werkruimtes op Scale. Na een downgrade stopt dat vanzelf.
- **MCP-tools:** blijven zichtbaar, maar zeggen dat het bij Scale hoort.

## Aanzetten (pas als Ezra het zegt)

1. Migratie `supabase/migrations/057_inventory_advice.sql` draaien in Supabase. Die is getest op Postgres (PGlite): RLS, policies, constraints en cascade.
2. In Vercel `NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED=true` zetten en opnieuw deployen. Zonder deze vlag geven de pagina en de API een 404, doet de cron niets en ontbreken de MCP-tools.
3. De cron `/api/cron/inventory` draait elke dag om 04:30 UTC. De eerste keer kun je op de pagina op "Nu bijwerken" klikken.
4. Shopify: zonder de optionele rechten `read_products` en `read_inventory` is er geen catalogus. De pagina zegt dat dan.

## Bekende grenzen

- **Geschiedenis:** bestellingen bewaren we 90 dagen. Voor de seizoensvergelijking houden we daarom anonieme dagtotalen 3 jaar bij. Oudere verkopen moeten via een CSV-import binnenkomen.
- **bol.com-catalogus:** die kennen we alleen via offers die in bestellingen voorkwamen. Een bol-offer zonder verkopen zien we dus niet. Daarvoor is een offer-export via de bol API nodig; dat volgt later.
- **WooCommerce:** inkoopprijs alleen als een cost-of-goods-plugin die als meta opslaat. EAN via `global_unique_id` of gangbare meta-velden.
- **Klantvragen** tellen alleen als het product in de vraag staat, of als het gesprek aan een bestelling met dat product hangt. Letter-maten (S, M, XL) tellen alleen na "maat" of "size".
