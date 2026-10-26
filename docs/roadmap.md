# Roadmap Support One

Opgesteld op 26 oktober 2026, op basis van Ezra's analyse ("wat Claude, ChatGPT en Sidekick overnemen en wat niet") en wat er al in de code staat. De volgorde is afgesproken met Navaron.

Wie iets oppakt, zet bij het nummer "Bezig: Claude" of "Bezig: Codex" met de branchnaam. Is het klaar, dan komt er "Klaar" en de datum bij. Werk volgens AGENTS.md: één bouwer per branch.

## Waar we ons op onderscheiden

Dit verhaal hoort in advertenties en op de landingspagina.

Een los model (ChatGPT, Claude, Shopify Sidekick) schrijft een antwoord, vat een FAQ samen of praat over je data. Wat het niet doet, en Support One wel:

- 24/7 draaien op je eigen mailbox: binnenhalen, in de wachtrij zetten, plannen, laten goedkeuren en versturen.
- Veilige acties uitvoeren, met controle of iets mag, blokkades, een audit-log en bevestiging vooraf.
- Een agentprofiel per winkel dat leert van oude mails en van wat de ondernemer aanpast.
- Geheugen per klant en per zaak.
- Nederlands: bol.com, WooCommerce, AVG, een verwerkersovereenkomst en vaste bewaartermijnen.
- Bol.com, Shopify en WooCommerce in één overzicht.

## Besluit over het koppelen van de mailbox (26 oktober)

- Gmail: we adverteren nu al met de huidige route. Die is "Inloggen met Google", met alleen het recht om te versturen, plus één keer doorsturen instellen. We meten hoeveel winkels afhaken bij de doorstuurstap.
- Outlook en Microsoft 365: "Inloggen met Microsoft" (zie 1). Daarbij is geen betaalde audit nodig.
- Een externe partij met CASA-audit (Unipile, Nylas, Aurinko), of zelf de CASA-audit doen, pas als de cijfers laten zien dat winkels echt afhaken bij het doorsturen.

## Volgorde

| # | Wat | Status |
|---|---|---|
| 1 | Outlook en Microsoft 365 via "Inloggen met Microsoft": ontvangen en versturen zonder doorsturen of wachtwoord | Bezig: Claude (`feat/outlook-koppelen`) |
| 2 | Laten zien wat het oplevert: "deze maand €X omzet gered, Y uur bespaard" (Ezra 29) | Open |
| 3 | Meer acties naast annuleren: terugbetaling of tegoed, adreswijziging, retourlabel, omruilen, kortingscode, met een limiet per winkel (bijvoorbeeld zelfstandig tot €25) (Ezra 22) | Open |
| 4 | Vertraagde zendingen zelf melden voordat de klant mailt; de trackingdata is er al (Ezra 19) | Open |
| 5 | Voorraadmelding op verkoopsnelheid ("over 9 dagen op") plus wat klanten vragen ("23 klanten vroegen naar maat M in groen") (Ezra 13 en 15) | Open |
| 6 | Wachtlijst "weer op voorraad" uit supportvragen; bouwt op 5 (Ezra 20) | Open |
| 7 | De briefing wekelijks mailen: top 3 problemen, omzet die op het spel staat, wat je moet doen. De briefing bestaat al (`commerce_intelligence_briefings`), alleen het mailen ontbreekt (Ezra 21) | Open |

## Later

Pas oppakken als het hierboven staat, of als klanten erom vragen.

- Retourredenen omzetten in een voorstel voor de maattabel of productpagina (Ezra 17)
- Veelgestelde vragen per product omzetten in een voorstel voor de producttekst; de pijnpuntenanalyse bestaat al in `lib/analytics/painPoints.ts` (Ezra 18)
- Advies voor de verdeling van de volgende levering per variant (Ezra 14)
- Een concept-inkooporder of mail aan de leverancier (Ezra 16)
- Een annulering of terugbetaling proberen te redden met een alternatief (Ezra 23)
- Reviews beantwoorden op Trustpilot, Google en bol.com (Ezra 25)
- WhatsApp, Instagram-DM en Shopify Inbox naast e-mail: een groot project (Ezra 24)
- Een eigen MCP-server, zodat de ondernemer vanuit Claude of ChatGPT met Support One praat (Ezra 27)
- Anonieme vergelijking tussen winkels: kan pas met tientallen winkels, en vraagt eerst een AVG-check (Ezra 28)

## Al gedaan of niet meer nodig

- Producten en voorraad lezen in Shopify (Ezra 12): live sinds 26 oktober als optionele rechten (migratie 054, PR #9, app-versie 3). Winkels geven die toestemming zelf onder Overview → "Products and stock".
- Per taak het beste model kiezen (Ezra 26): de app wisselt al tussen AI-aanbieders (`lib/ai/providerAvailability.ts`).
- Lage voorraad: het dashboard telt nu 5 stuks of minder. Nummer 5 vervangt dat door een telling op verkoopsnelheid.
