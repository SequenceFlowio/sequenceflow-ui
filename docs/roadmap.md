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

## Inkoopadvies per variant (Ezra, 28 okt)

Bundelt 5, 6, 7, 14 en 16: verkoop en voorraad per variant bijhouden, dode voorraad en bijna-op tonen, inkoopadvies per levering en seizoen, wekelijks per mail en via MCP. Plan: https://claude.ai/artifact/X2SFbtj3ygZJccumeEmuaC. Bezig: Claude (`feat/inkoopadvies`). Staat achter `NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED`; niet live tot Ezra het zegt.

## Doorverwijzen en affiliates (Ezra, 31 okt)

Klanten verwijzen door voor tegoed (max 5), iedereen kan affiliate worden voor 5% (klant 1–5) en 10% (vanaf klant 6) zolang de klant betaalt, met een leaderboard op sequenceflow.io/affiliate. Zie docs/referrals.md. Bezig: Claude (`feat/referrals-affiliates`). Wacht op migratie 059 in productie.

## Volgorde

| # | Wat | Status |
|---|---|---|
| 1 | Outlook en Microsoft 365 via "Inloggen met Microsoft": ontvangen en versturen zonder doorsturen of wachtwoord | Bezig: Claude (`feat/outlook-koppelen`) |
| 2 | Laten zien wat het oplevert: "deze maand €X omzet gered, Y uur bespaard" (Ezra 29) | Klaar (6 nov, Claude, PR #62): uren bespaard en waarde werktijd op het overzicht. "Omzet gered" bewust nog niet: dat meten we niet betrouwbaar |
| 3 | Meer acties naast annuleren: terugbetaling of tegoed, adreswijziging, retourlabel, omruilen, kortingscode, met een limiet per winkel (bijvoorbeeld zelfstandig tot €25) (Ezra 22) | Open |
| 4 | Vertraagde zendingen zelf melden voordat de klant mailt; de trackingdata is er al (Ezra 19) | Deels klaar (6 nov, Claude, PR #64): herkenning + melding op het overzicht met kopieerbaar bericht. Automatisch naar de klant sturen wacht op een besluit (bol-klantcontact loopt via bol) |
| 5 | Voorraadmelding op verkoopsnelheid ("over 9 dagen op") plus wat klanten vragen ("23 klanten vroegen naar maat M in groen") (Ezra 13 en 15) | Klaar (PR #25, gemerged 3 nov). Vera heet inmiddels Otis. Zie docs/plan-vera.md |
| 6 | Wachtlijst "weer op voorraad" uit supportvragen; bouwt op 5 (Ezra 20) | Klaar (PR #25, 3 nov): trigger "weer op voorraad" plus mail na Verstuur vanuit de eigen mailbox |
| 7 | De briefing wekelijks mailen: top 3 problemen, omzet die op het spel staat, wat je moet doen. De briefing bestaat al (`commerce_intelligence_briefings`), alleen het mailen ontbreekt (Ezra 21) | Klaar (6 nov, Claude, PR #63): elke maandag een mail van Seffy met activiteit, tijdwinst, wat wacht, top 3 pijnpunten en bol-signalen; Otis mailt de voorraadkant dagelijks en wekelijks |

## Later

Pas oppakken als het hierboven staat, of als klanten erom vragen.

- Retourredenen omzetten in een voorstel voor de maattabel of productpagina (Ezra 17)
- Veelgestelde vragen per product omzetten in een voorstel voor de producttekst; de pijnpuntenanalyse bestaat al in `lib/analytics/painPoints.ts` (Ezra 18)
- Advies voor de verdeling van de volgende levering per variant (Ezra 14) — Bezig: Claude (`feat/vera-alerts`, PR #25): in de chat en via MCP
- Een concept-inkooporder of mail aan de leverancier (Ezra 16) — Bezig: Claude (`feat/vera-alerts`, PR #25): Vera fase 3, met leveranciers onder Instellingen
- Een annulering of terugbetaling proberen te redden met een alternatief (Ezra 23)
- Reviews beantwoorden op Trustpilot, Google en bol.com (Ezra 25)
- WhatsApp, Instagram-DM en Shopify Inbox naast e-mail: een groot project (Ezra 24)
- Een eigen MCP-server, zodat de ondernemer vanuit Claude of ChatGPT met Support One praat (Ezra 27) — Bezig: Claude (`feat/mcp-server`), op verzoek van Ezra naar voren gehaald
- Anonieme vergelijking tussen winkels: kan pas met tientallen winkels, en vraagt eerst een AVG-check (Ezra 28)

## Al gedaan of niet meer nodig

- Producten en voorraad lezen in Shopify (Ezra 12): live sinds 26 oktober als optionele rechten (migratie 054, PR #9, app-versie 3). Winkels geven die toestemming zelf onder Overview → "Products and stock".
- Per taak het beste model kiezen (Ezra 26): de app wisselt al tussen AI-aanbieders (`lib/ai/providerAvailability.ts`).
- WooCommerce staat weer aan (28 okt), alleen lezen: bestellingen als context, annuleren blijft uit. Koppelingen is nu een overzicht met tegels (PR feat/integrations-overview).
- Lage voorraad: het dashboard telt nu 5 stuks of minder. Nummer 5 vervangt dat door een telling op verkoopsnelheid.

## Prioriteit: outcome-prijzen (Navaron, 5 nov)

**Klaar en live (6 nov, Claude, op verzoek van Navaron; voortgebouwd op het fundament van Codex).** Starter €49 / Growth €149 / Scale €299 met 100 / 400 / 1.000 afgehandelde gesprekken inbegrepen, daarboven €0,49 (gecontroleerd) of €0,99 (zelfstandig); details in docs/plan-prijzen-en-mascotte-vervolg.md §10–11. Nog open: Shopify-route (prijzen en gebruik via Shopify). Oorspronkelijk: featurepakketten €49/€149/€299 plus voorlopig €0,99 per gecontroleerd afgehandeld gesprek. Eerst proeftelling zonder facturatie, daarna pilot en providerintegratie. Zie [uitvoeringsplan](plan-mascottes-chat-privacy-nov-2026.md#9-prijsmodel-basisabonnement--werkelijk-gebruik). Bestaande contracten blijven ongewijzigd.

## Seffy-animaties, 7 november

Klaar lokaal: Codex (`codex/seffy-motion`). Seffy in de /s1-titel gebruikt Milo’s bolrotatie (geen rotateY-kaart), met geprojecteerde headsetdelen voor/achter het hoofd. Toegevoegd: nieuwsgierige ongelijke ogen, luisterhouding, tevreden oogboogjes, kleine schaalverandering, hop en knipoog met ster. Geen antenne of ontwerpwijziging. TypeScript, gerichte ESLint, productiebuild en geometrische tests geslaagd; lokale browser gecontroleerd. Preview: http://localhost:3216/support-one. Nog niet gepusht of geïntegreerd; wacht op Ezra. Bij zijn definitieve paginaverplaatsing de losse HeroSeffy-component in de nieuwe titel gebruiken. Analyse: [mascotte-beweging](seffy-motion.md).

## Header en foutmelding, 7 november

Klaar lokaal: Codex (`codex/seffy-motion`). Websiteheader heeft Wat het doet / Bedrijf / Prijzen; Inloggen en Kennismaken blijven op mobiel zichtbaar. Openbare foutpagina verwijst naar home, app-routes behouden de inbox. Nederlandse en Engelse fouttekst aangepast. Gerichte lint en productiebuild geslaagd; mobiele header in browser gecontroleerd. Nog niet naar main.

## Videocover en volledig scherm, 7 november

Codex (`codex/seffy-motion`): rustige productcover met Seffy-antwoord en Otis-signaal, plus fullscreenknop met iPhone/Safari-terugval. Afspelen, pauzeren en fullscreen openen/sluiten lokaal in de browser gecontroleerd. Gerichte lint en productiebuild geslaagd.

## Prijzenpagina opschonen, 7 november

Klaar lokaal: Codex (`codex/pricing-page-polish`). Uitlegkop werkelijk gecentreerd, introductie en rekenuitleg ingekort, inrichting en maatwerk in twee compacte kaarten. Bedragen, limieten en rekenlogica ongewijzigd. Desktop en mobiel (390 px) bekeken; pakketkeuze calculator gecontroleerd. Niet naar main op verzoek van Navaron.

Websitecontrole afgerond op dezelfde branch: [bevindingen en controles](website-review-2026-11-07.md). Extra verbeteringen: toetsenbordbediening tabs/rekenhulp, mobiele taalswitch, compacte videocover op smalle telefoons en expliciete voorbeeldlabel affiliate-leaderboard.

## Jaarbetaling (7 november)

Bezig: Codex (`codex/annual-billing`). 20% korting op de basisprijs bij jaarlijkse vooruitbetaling: €451,20 / €1.411,20 / €2.851,20. Bundels vernieuwen maandelijks; gebruikstarieven blijven gelijk. Geen migratie van bestaande abonnementen zonder keuze van de klant.

## Betaalde inrichting verwijderen (14 november)

Bezig: Codex (`codex/remove-paid-setup`). Het eenmalige setup-aanbod van €490 vervalt; klanten stellen zelf in. Prijskaarten en aanvraagformulier noemen alleen nog maatwerk.
