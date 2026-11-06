# Vervolgplan: prijzen en kleine mascotte-effecten

Datum: 5 november 2026. Status: analyse; uitvoering gepauzeerd op verzoek gebruiker. Alleen dit document gewijzigd. Codebasis gecontroleerd op origin/main 4a0488b. Geen Stripe-, database-, omgevings- of productiewijzigingen.

## Wat Claude al heeft gedaan

De centrale team-chat is geïntegreerd: Milo als ingang, Seffy voor klantmails, Otis voor voorraad, Juno als early access. Voorraad heeft geen aparte Vera-tab meer; signalen staan bij Overzicht, regels bij Instellingen. Site-chat gebruikt Milo. Mascottes gebruiken merkgroen met onderscheid via accessoires. HeroMilo heeft draaien, rondjes en sprongen; SequenceMark ondersteunt een volumetrische draai. De prijspagina gebruikt gedeelde navigatie. Dit is vastgesteld in code en commits, niet opnieuw end-to-end bewezen in deze analyse. Bestaand werk behouden.

## 1. Kleine hero-effecten

> Gedaan 5 nov (Claude, `feat/hero-effecten`): windstreepjes bij het draaien, knipoog met sterretje, draai loopt vloeiend uit in de blik. Daarbij op de homepage: Seffy in de Support One-kaart, Otis bovenaan het voorraadsignaal, grote Milo met antenne onderaan.

Behoud Milo en de huidige animaties. Voeg bij draaien twee of drie dunne gebogen windstrepen toe, die de draairichting volgen en direct uitdoven. Bij een incidentele bewuste knipoog één klein sterretje naast het oog; niet bij iedere natuurlijke knippering. Geen permanente deeltjes of effect over titeltekst.

Implementatie later in HeroMilo met expliciete bewegingsfasen. Let op: onAnimationEnd op de wrapper ontvangt ook events van kinderen; eindigende wind-/steranimaties mogen de hoofdbeweging niet voortijdig resetten. Effecten decoratief, zonder pointer-events, zonder layoutverschuiving. Reduced motion schakelt hoofdbeweging én effecten uit. Controle op mobiel, clipping, meerdere herhalingen en tabwisselen. Geen verandering aan alle mascottes in de app nodig.

## 2. Afgesproken prijzen — bijgewerkt na akkoord gebruiker op 5 november

| Pakket | Basis per werkruimte/maand | AI-ondersteund afgehandeld | Zelfstandig AI-afgehandeld |
| --- | ---: | ---: | ---: |
| Starter | €49 | €0,49 | Niet beschikbaar zolang automatisch versturen hier gelockt is |
| Growth | €149 | €0,49 | €0,99 zodra betrouwbaar meetbaar |
| Scale | €299 | €0,49 | €0,99 zodra betrouwbaar meetbaar |

Exclusief btw. Gebruiker heeft dit testmodel goedgekeurd. Het vervangt het eerdere voorstel van €0,99 voor iedere afhandeling. De code/outcomePilot is nog NIET aangepast en bevat het oude schaduwmodel. Per case maximaal één tarief, nooit €0,49 plus €0,99. Menselijke goedkeuring/inhoudelijke aanpassing betekent AI-ondersteund. Alleen automatische verzending is niet voldoende bewijs voor zelfstandige afhandeling. Een escalatie is niet betaalbaar; eventuele latere succesvolle afhandeling vereist nieuwe bewijsbeoordeling en hoogstens één telling. Content One valt buiten deze tarieven.

Geen kosten voor ongebruikte concepten, spam, mislukte/noodantwoorden, ontvangstbevestigingen, wedervragen of hergeneratie. Vervolgvragen over hetzelfde probleem blijven dezelfde case. Heropeningen en onterechte tellingen hebben een zichtbaar correctiepad. De 72 uur is observatie, geen zelfstandig bewijs van succes.

Proefvoorstel behouden: 14 dagen/maximaal 50 afhandelingen zonder abonnement- of gebruikskosten, geen automatische betaalde overgang zonder instemming. Start commercieel met Starter + €0,49 en begeleide pilots. Featurepakketten aanbieden waar hun extra waarde aantoonbaar is; de twee gebruikstarieven blijven pakket-onafhankelijk wanneer de benodigde functie beschikbaar is.

## 3. Wat technisch nog ontbreekt

- lib/planCatalog.ts verkoopt nog €79/€229/€549 met 150/500/1.500 concepten. lib/billingPlans.ts handhaaft die volumes plus 10% speling; proef is nog 150 concepten.
- lib/billing/outcomePilot.ts bevat alleen een pure schaduwberekening. Geen bewijsadapter, duurzaam register of providerafrekening.
- Checkout verkoopt één vaste prijs, quantity 1. Geen tweede gebruikscomponent of budgetinstemming.
- Stripe-webhook pakt bij subscription.updated het eerste item; prijsherkenning kent uitsluitend de drie huidige environment-ID's. Nieuwe en oude prijsversies moeten naast elkaar herkenbaar worden en het basisitem expliciet gevonden worden.
- Webhook-deduplicatie registreert vóór verwerking. Een fout daarna kan bij retry als duplicate worden overgeslagen. Nodig: retrybare verwerking met status/claim en idempotente neveneffecten; registerfouten niet stilzwijgend negeren. Dit is codeanalyse, geen vastgestelde productiestoring.
- Afhandeling vereist een inhoudelijk verstuurd antwoord, controle van de uitkomst en 72 uur observatie sinds het laatste inhoudelijke antwoord. Ontvangstbevestiging, wedervraag, spam, escalatie of fout telt niet. Stilte alleen is onvoldoende. Ontbrekende Gmail-replies buiten de app blokkeren betrouwbare automatische telling.
- Shopify heeft een eigen billingroute en blokkeert Stripe-checkout voor Shopify-billingklanten. Afzonderlijke providerimplementatie nodig; niet stilzwijgend naar Stripe verplaatsen.
- Bestaande prijzen in het echte Stripe-account, actieve abonnementen, belastinginstellingen en portalconfiguratie zijn nog NIET gecontroleerd. De zichtbare browserinventaris bevatte geen Stripe-tab; hieruit volgt niets over de accountinstellingen.

## 3b. Stripe-inventaris (5 november, alleen gelezen, niets gewijzigd)

- **Live-account "Sequence Flow"**: producten Support One Starter/Growth/Scale (elk 3 prijzen: huidige standaard plus 2 gearchiveerde; Starter staat op €79, eerder €39 en €49) en drie oude Content Generator-producten (€49/€89/€249). Alle SaaS-belastingcode txcd_10103001.
- **Abonnementen: geen enkel, ooit.** MRR €0, omzet €0. Er zijn dus geen bestaande Stripe-contracten om te beschermen.
- **Sandbox**: geen producten.
- **Btw**: hoofdkantoor Nederland, standaardcategorie SaaS zakelijk. Of prijzen incl./excl. btw zijn, moet bij het aanmaken van de nieuwe prijzen expliciet (plan: excl. btw).
- **Klantportaal**: geconfigureerd, maar zonder links naar voorwaarden en privacy. Die toevoegen voor livegang.
- **Database**: 10 werkruimtes in proef, 3 verlopen, 2 op "pro" zonder Stripe-abonnement (handmatig of via Shopify-billing, die apart in `lib/shopify/billing*` zit).

**Gevolg voor het plan:** prijsversies naast elkaar herkennen is voor Stripe niet nodig, er zijn geen oude abonnementen. Bij livegang: nieuwe prijzen aanmaken, de huidige archiveren, environment-ID's vervangen. De twee "pro"-werkruimtes en Shopify-billing wel apart nalopen.

## 3c. Teller afgehandelde gesprekken (5 november, alleen meten)

Regels in `lib/billing/handledConversations.ts`, getest. Een gesprek telt na een verstuurd inhoudelijk AI-antwoord en 72 uur zonder dat de klant terugkomt (ook een bedankje laat hem vervallen). Wedervraag, concept en spam tellen niet. Zelfstandig (automatisch verstuurd) €0,99, gecontroleerd of ingepland €0,49; na terugkomen hooguit €0,49; maximaal één keer per gesprek. Geen handmatige "opgelost"-klik: dat kost de klant een klik per gesprek en geeft rare rekeningen bij vergeten.

Vastgelegd bij het versturen in `support_messages.metadata` (`reply_kind`, `reply_purpose`, `decision_id`); antwoorden van vóór 5 november tellen niet. Lezen via `GET /api/billing/handled`. Geen migratie, niets gefactureerd. Terugblik op bestaande data (vooral testverkeer): 12 van 20 beantwoorde gesprekken hielden 72 uur stand.

## 4. Uitvoeringsvolgorde na hervatting

1. Stripe read-only inventariseren: juiste account en live/test, producten, prijzen, abonnementsaantallen, betaalperioden, portal en belastinginstellingen. Geen secrets in rapport. Definitieve eenheid/correctieregels in klanttaal vastleggen.
2. Versiegebonden tarieven en rechten invoeren. Bestaande contracten behouden; nieuw model apart herkennen. Growth behoudt automatisering/inzichten, Scale voorraad en samenwerking volgens aantoonbare functies. Interne ids starter/pro/agency behouden. Oude conceptlimieten alleen voor oude contracten; nieuwe kostenplafonds mogen geen inkomende mails verliezen.
3. Duurzaam register en bewijsadapter bouwen: werkruimte-isolatie, één afhandeling per case, exacte antwoordversie, observatie, heropening/correcties, periode, tariefversie en providerreceipt. Begin met schaduwmetingen. Migratie voorbereiden; productiedatabase pas na afzonderlijke toestemming.
4. Stripe sandbox: vaste basis plus verbruiksprijs, veilige retries, expliciete basisitemselectie, oude prijs-ID's blijven werken. Eerst actuele Stripe-documentatie raadplegen voor meter/correcties. Geen historische concepten alsnog factureren.
5. App toont basisprijs, voorlopige en definitieve afhandelingen, redenen, kosten, maandbudget en waarschuwingen. NL/EN, checkout, prijzen, trial, voorwaarden, affiliateberekeningen en factuur consistent maken. Geen onbewezen functiebeloften of besparingen.
6. Testen: dubbele events, verwerking die halverwege faalt, follow-up, spamcorrectie, periodegrens/72 uur, budgetgrens, upgrades, oude contracten, credits/refunds en providerisolatie. Pas daarna nieuwe Stripe-liveprijzen activeren voor nieuwe instemmende klanten; bestaande abonnementen niet bulk wijzigen. Shopify afzonderlijk afmaken voordat hetzelfde aanbod daar wordt verkocht.
7. Hero-effecten als aparte kleine wijziging en visuele desktop/mobielcontrole. Behoud Claude's ontwerp en groene familie.

## Buiten deze ronde

Cookies en captcha bewust apart. Juno is nog early access; een volledige contentagent bouwen valt niet onder deze prijswijziging. Google-loginfix staat in code, maar echte eerste login in schone browser blijft een verificatiepunt uit de overdracht. Geen nieuwe uitrol of productie-incasso tijdens deze analyse.

## 5. Eén prijs- en rechtenmodel op alle plekken

Bouw één versiegebonden catalogus voor bedragen, factuureenheden, functies en limieten. UI én server gebruiken dezelfde definities. Leg oude contracten apart vast: bestaande abonnementen behouden hun prijsversie en rechten tot expliciete migratie. Alleen environment-ID's vervangen zou oude abonnementen onherkenbaar kunnen maken.

### Rechtenmatrix voor uitvoering (bestaande featureverschillen behouden)

| Functie | Starter | Growth | Scale |
| --- | --- | --- | --- |
| Inbox, handmatig verzenden, AI-voorstellen, antwoordstijl | Ja | Ja | Ja |
| Supportmailboxen | 1 | 1 | 1 |
| Teamleden | 2 | 5 | Onbeperkt volgens huidige catalogus |
| Kennisdocumenten | 25 | 100 | Onbeperkt volgens huidige catalogus |
| Automatisch versturen | Gelockt | Optioneel | Optioneel |
| Uitgebreide inzichten, klantpijnpunten, interne Milo-analyse | Gelockt | Ja | Ja |
| Voorraad, inkoopadvies, Otis-tools | Gelockt | Gelockt | Ja, indien live |
| Prioriteitsondersteuning | Nee | Nee | Ja |
| Maandbudget, kostenoverzicht, bezwaar/correctie | Ja | Ja | Ja |
| Vaste conceptbundel als betaalgrens (nieuwe contracten) | Nee | Nee | Nee |

De matrix is een implementatievoorstel op basis van huidige rechten. Voor publiceren elke belofte tegen werkelijke functies testen. Afzonderlijke rollen (admin/member) blijven gelden binnen ieder pakket. Trial/custom/whitelist en bestaande contracten apart testen. Algemene producthulp moet bereikbaar blijven zonder betaald analyse-recht; geen onbruikbare chatbadge voor Starter. Geen nieuw uitgebreid rollenstelsel beloven als het nog niet bestaat. Onbeperkt is geen belofte van onbeperkte API/AI-kosten: technische misbruiklimieten los van commerciële eenheden houden.

### Verplichte controlelijst

- **Catalogus en rechten:** lib/planCatalog.ts, lib/billingPlans.ts, lib/billing.ts, outcomePilot, server-gates, tenantplan/prijsversie. Verwijder oude conceptquota alleen voor nieuwe contracten; technische kostenbeveiliging behouden.
- **Publieke prijzen:** beide homepages, app/pricing/page.tsx (heeft eigen hardcoded bedragen), marketingcomponenten, FAQ, vergelijking, CTA's, trialteksten, metadata/structured data, app/llms.txt/route.ts, lib/marketing/siteChat.ts (oude prijsantwoorden), NL/EN. Ook prompts/kennisbronnen met oude prijzen nalopen.
- **App:** BillingSettings, upgrade-schermen, Sidebar/paywalls, trialbanner, verbruik API en meter, meldingen bij budget/plafond. Toon basis + gebruik + geschat totaal en betaalbare versus nog voorlopige cases.
- **Locks:** UI, directe URL, API, achtergrondtaken/autosend, voorraadcron, MCP en teamchattools voor ieder pakket testen. Een verborgen knop is geen serverbeveiliging. Upgrade/downgrade mag geen gegevens wissen; onbeschikbare automations veilig stoppen.
- **Stripe:** account/test/live controleren; nieuwe basisprijzen plus afzonderlijke gebruikscomponenten voor beide eenheden; oude Price-ID's behouden; checkout, portal, webhook, retries, correcties/creditnota's, btw, factuurregels, proratie, opzegging en mislukte betaling. Gebruiksprijs zonder hoeveelheid is niet genoeg: meter/export en reconciliatie nodig. Geen bestaande klanten automatisch omzetten.
- **Shopify:** aparte billing ownership en prijsconfiguratie; geen Stripe-inning voor Shopify-accounts. Aanbod en rechten mogen niet vooruitlopen op providerondersteuning.
- **Affiliates/referrals:** app/affiliate/page.tsx bevat €229/€11,45/€22,90; calculator, welkomstcredits, commissies en refunds nalopen. Expliciet vastleggen of commissie over basis, gebruik of beide gaat, volgens bestaande afspraken; nooit btw of terugbetaalde bedragen meetellen. Niet stilzwijgend commissieregels veranderen.
- **Voorwaarden en hulp:** eenheidsdefinitie, 72 uur, menselijke bijdrage, spam/fouten, heropening, budgetgedrag, proefperiode en overgang oude klanten in begrijpelijke NL/EN-tekst.
- **Acceptatie:** volledige aankoop → rechten → afhandeling → observatie → factuur → correctie, inclusief dubbele events, periodegrens, downtime en kostenplafond. Zoek op oude bedragen/bundels met gerichte uitzonderingen voor legacytests/contracten. Niets live totdat bedragen en werking gezamenlijk kloppen.

## 6. Rekenscenario: €10.000 maandelijkse operationele winst

Geen marktvoorspelling of bewezen tiermix. Werkhypothese: 60% Starter, 30% Growth, 10% Scale; één betalende werkruimte per klant. Alle afhandelingen in dit startscenario zijn AI-ondersteund à €0,49. Zelfstandige automation wordt nog niet als winstbron verondersteld. Gemiddeld per maand 100/300/800 betaalbare afhandelingen voor Starter/Growth/Scale. Geen spam, trial of mislukte antwoorden in dit volume.

| Pakket | Klanten | Afhandelingen per klant | Omzet per klant | Omzet |
| --- | ---: | ---: | ---: | ---: |
| Starter | 48 | 100 | €98 | €4.704 |
| Growth | 24 | 300 | €296 | €7.104 |
| Scale | 8 | 800 | €691 | €5.528 |
| Totaal | 80 | 18.400 in totaal | Gemiddeld €216,70 | €17.336 |

Rekenaanname directe kosten 25% (€4.334): AI en retries, variabele infra, betaalfees, operationele ondersteuning en toepasselijke affiliatecommissies. Vaste operationele kosten verondersteld €3.000/maand: overige tooling/infra, administratie, marketing en ingehuurde werkzaamheden; geen dubbel tellen met directe kosten. Resultaat €17.336 − €4.334 − €3.000 = €10.002 per maand. Alle bedragen exclusief btw. Voor winstbelasting, financiering en ondernemersbeloning die niet in die €3.000 zit. Geen €10.000 netto privé en geen gegarandeerde uitkomst. Jaarlijkse contracten/vooruitbetaling niet verwarren met omzet per maand.

Benodigd aantal = afronden naar boven ((winstdoel + vaste kosten) / (gemiddelde omzet per klant × contributiemarge)). Bij dezelfde omzet per klant en €3.000 vaste kosten: 60% marge circa 100 klanten, 75% circa 80, 85% circa 71. Werkelijke gehele tiermix kan een paar klanten afwijken. Halve gebruiksaantallen geeft €160,35 gemiddelde omzet en bij 75% marge circa 109 klanten. Zonder gebruiksomzet zou €104,00 gemiddelde basisomzet circa 167 klanten vragen. Bij €6.000 in plaats van €3.000 vaste kosten en originele gebruiksaannames circa 99 klanten.

Meet 5–10 pilots gedurende 4–6 weken: tijdwinst na correcties, uitkomstkwaliteit/heropening, echte betaalbare volumes, alle leveringskosten en betaalconversie. Daarna meerdere betaalde maanden volgen voor retentie, acquisitiekosten en seizoenen. Gebruik bovenstaande mix uitsluitend als begrotingsscenario totdat cohortdata beschikbaar is. Voor privé-netto doel aparte berekening met rechtsvorm, belasting en beloning; hier geen belastingtarief aangenomen.

## 7. Stand 5 november (avond)

Gedaan en live: teller afgehandelde gesprekken (#40), register + maandbudget + gebruik naar Stripe + checkout + opzetscript, alles nog uit (#41, migratie 068), nieuwe prijskaarten op /design/prijzen (#41, #42), Analytics in alle pakketten en overal dezelfde naam (#43). Pijnpunten blijft vanaf Growth.

Nog vóór de nieuwe prijzen live kunnen:
1. Stripe-sandbox: opzetscript draaien, testaankoop, testverbruik op de factuur. Nodig: sandbox-sleutel in `.env.local` (door de gebruiker gezet).
2. App: kostenoverzicht (afgehandeld, in controle, kosten), maandbudget instellen, melding bij 80% en 100%.
3. Conceptlimieten (150/500/1.500) loslaten voor nieuwe abonnementen; technische misbruikgrens houden.
4. Upgraden/downgraden zelf regelen (het portaal wisselt geen abonnementen met meerdere prijsregels; in sandbox bevestigen).
5. Voorwaarden (eenheid, 72 uur, budget) en links naar voorwaarden en privacy in het Stripe-portaal.
6. Live: `scripts/stripe-usage-setup.ts --live`, env-vars in Vercel, `NEXT_PUBLIC_PRICING_V2=on`. Alleen met akkoord van de gebruiker.
7. Shopify-facturering apart.

## 7b. Support-landingspagina: sectie Pijnpunten

Op support.sequenceflow.io een sectie die laat zien hoe Pijnpunten werkt (Growth en hoger), met beweging. Eerst in de app kijken hoe het blok "Pijnpunten: waar klanten tegenaan lopen" werkt en het zo getrouw mogelijk naspelen.
- Voorbeeld (speelgoedwinkel): klantvragen stromen binnen en groeperen zich zichtbaar tot één thema, "Wieltjes ontbreken bij de speelgoedauto", met een teller die oploopt (bijvoorbeeld 14 vragen deze maand).
- Daaronder het AI-advies in het merkgroen: dozen steekproefsgewijs openen en controleren of alles compleet is; de leverancier vragen de volgende levering te dubbelchecken; een zin in de productbeschrijving of verpakking zetten.
- Animatie licht en vloeiend (vragen schuiven in, het thema licht op, het advies verschijnt regel voor regel); uit bij "minder beweging".
- Als klikbaar ontwerp onder /design laten zien vóór het live gaat.
- **Status 6 nov:** gebouwd als `components/marketing/PainPointsShowcase.tsx`, te bekijken op /design/pijnpunten. Wacht op akkoord; daarna als 07 in `SupportStory`. Let op: het Pijnpunten-blok zelf staat sinds de analytics-herbouw (juli) niet meer in de app; de API (`/api/analytics/pain-points`) bestaat nog. Dat moet terug voordat we het op de site beloven.

## 8. Daarna: Content One op de site opnieuw

De voorbeelden overtuigen niet (de witte sneaker, het blok "Een ander format, nog steeds jouw merk"). Ideeën, eerst als klikbaar ontwerp onder /design:
- Laat het resultaat zien: één productfoto, ernaast een kant-en-klare post mét caption, een carrousel en een TikTok-hook als tekst.
- "Je week staat klaar": een weekkalender met gevulde dagen, Juno (camera) als maker. Voordeel in één oogopslag: nooit meer een lege feed.
- Een product en beeld dat bij de doelgroep past (beauty of mode van een kleine webshop), minder stockfoto.

## 9. Laatste fase: SequenceFlow-assistent voor onze eigen klanten

Pas zinvol als er genoeg betalende klanten en supportvragen zijn. Doel: snel zien en oplossen waar klanten tegenaan lopen.

- **Wat:** een eigen agent op de SequenceFlow-supportmailbox (en later de chat in de app). Hij beantwoordt klanten zoals Support One dat voor webshops doet, met onze eigen kennis: prijzen, facturen, koppelen, veelgestelde problemen.
- **Signaleren:** hij groepeert binnenkomende vragen in thema's (betalingen, onduidelijke schermen, koppelproblemen, bugs) en meldt wat vaak terugkomt of nieuw is, met voorbeelden. Een vaste samenvatting per week, en direct een seintje bij iets dat veel klanten raakt.
- **Voorstellen en oplossen:** per probleem een concreet voorstel (tekst aanpassen, uitleg toevoegen, bug met vermoedelijke oorzaak). Eenvoudige fixes zet hij klaar als PR op een eigen branch; mergen blijft een mens. Niets aan productie, betalingen of klantdata zonder akkoord.
- **Hoe:** we bouwen op Support One zelf (eigen werkruimte voor SequenceFlow), met een extra laag voor thema's en voorstellen; geen losse app nodig, tenzij het scheiden van klantdata dat vraagt. Dat beslissen we bij de start.
- **Veiligheid:** klantmails zijn data, geen opdrachten; de agent volgt nooit instructies uit een mail. Persoonsgegevens blijven in de eigen werkruimte en gaan niet mee in PR's of issues.
