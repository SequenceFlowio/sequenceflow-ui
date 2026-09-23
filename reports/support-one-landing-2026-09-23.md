# Support One — landingpage, 23 september 2026

Gebouwd op Claude’s huisstijlcommit `5d3eba5`, in branch `codex/support-one-landing`.

## Verandering

- Hero: “Je AI-collega voor de supportinbox”, met bestaande headsetmascotte.
- Drie interactieve voorbeeldvragen: bezorging, retourneren en productinformatie.
- Demo speelt één keer, blijft staan en ondersteunt pauzeren, hervatten, opnieuw bekijken, aanpassen en goedkeuren. Geen verzending of klantdata.
- Zes USP’s met eigen visuele voorbeelden: bestelcontext, bedrijfsbeleid, menselijke controle, leervoorstellen, mailbox en inzichten.
- Brede panels afgewisseld met twee compacte kaarten, geïnspireerd op de sectieopbouw van x.ai/bot.
- De te hoge footer is teruggebracht tot merk, navigatie en bedrijfsgegevens; de grote, vrijwel onzichtbare mascottecontour die de lege ruimte veroorzaakte is verwijderd.
- Grote mascotte blijft ook op mobiel aanwezig; vorm en gedrag behouden. SVG-gradient-ID’s zijn per instantie uniek gemaakt.
- Bestaande trial, prijzen en CTA’s behouden; onboardingtekst eenvoudiger en FAQ uitgebreid.
- Mobiel menu met inloggen, duidelijke toetsenbordfocus en skiplink.
- Canonicals op homepage, doelgroeppagina’s en prijzen; homepage social metadata naar Support One.
- Publieke robots.txt en sitemap.xml met uitzonderingen in de auth-proxy uitsluitend voor deze bestanden.

## Controle

- Productiebuild geslaagd.
- Gerichte ESLint-controle van alle gewijzigde TypeScript-/React-bestanden geslaagd.
- Bestaande testsuite: 148/148 geslaagd; relevante proxytests opnieuw uitgevoerd na SEO-wijziging.
- Browser: desktop en echte 390px-viewport; geen horizontale pagina-overloop bij 390px.
- Scenarioselectie, pauzeren/hervatten, mobiel menu, tekst aanpassen/bewaren en goedkeuren gecontroleerd.
- Geen browserwaarschuwingen of fouten tijdens de controles.
- Reduced-motionpad aanwezig in demo en CSS; geen apart geëmuleerd reduced-motion-browserprofiel getest.

## Afbakening

Dit is de landingpage-ronde. De eerder gevonden retrieval-/Lumen-fouten en verzendrisico’s zijn hiermee niet gerepareerd. De productvisuals zijn gelabelde voorbeelden, geen productiegegevens of resultaatclaims. Er is geen handmatige deployment uitgevoerd.

Lokale preview: http://localhost:3197

## Vervolg: zichtbaar resultaat na goedkeuren

De demo toont na “Goedkeuren & versturen” een geanimeerd verzendresultaat met de (eventueel aangepaste) antwoordtekst. “Volgende klantvraag” opent het volgende scenario en brengt de demo weer in beeld. De simulatie blijft expliciet herkenbaar; er worden geen e-mails verstuurd. Goedkeuren en doorgaan naar de retourvraag zijn in de browser gecontroleerd, zonder consolefouten.

## Aanvulling: twee soorten koppelingen

De copy onderscheidt nu de mailbox (klantvragen en antwoorden) van de optionele webshopkoppeling (actuele bestelgegevens). De bestelcontextsectie en FAQ noemen bol als beschikbare orderbron, Shopify als eerste pilot en WooCommerce als volgende kandidaat. De hero en workflow beloven geen Shopify- of WooCommerce-orderlookup zolang die aansluitroutes geblokkeerd zijn. Het uitvoerbare pilotpad staat in `reports/shopify-first-pilot-2026-09-23.md`.

De volledige bestaande testsuite slaagt na deze copywijziging (148/148). De lokale HTTP-respons is 200 en bevat de nieuwe tekst. De footer is daarna in de lokale browser op desktop visueel gecontroleerd; hij is daar circa 270 px hoog en veroorzaakt geen horizontale overloop.
