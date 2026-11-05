# Vervolgplan: prijzen en kleine mascotte-effecten

Datum: 5 november 2026. Status: analyse; uitvoering gepauzeerd op verzoek gebruiker. Alleen dit document gewijzigd. Codebasis gecontroleerd op origin/main 4a0488b. Geen Stripe-, database-, omgevings- of productiewijzigingen.

## Wat Claude al heeft gedaan

De centrale team-chat is geïntegreerd: Milo als ingang, Seffy voor klantmails, Otis voor voorraad, Juno als early access. Voorraad heeft geen aparte Vera-tab meer; signalen staan bij Overzicht, regels bij Instellingen. Site-chat gebruikt Milo. Mascottes gebruiken merkgroen met onderscheid via accessoires. HeroMilo heeft draaien, rondjes en sprongen; SequenceMark ondersteunt een volumetrische draai. De prijspagina gebruikt gedeelde navigatie. Dit is vastgesteld in code en commits, niet opnieuw end-to-end bewezen in deze analyse. Bestaand werk behouden.

## 1. Kleine hero-effecten

Behoud Milo en de huidige animaties. Voeg bij draaien twee of drie dunne gebogen windstrepen toe, die de draairichting volgen en direct uitdoven. Bij een incidentele bewuste knipoog één klein sterretje naast het oog; niet bij iedere natuurlijke knippering. Geen permanente deeltjes of effect over titeltekst.

Implementatie later in HeroMilo met expliciete bewegingsfasen. Let op: onAnimationEnd op de wrapper ontvangt ook events van kinderen; eindigende wind-/steranimaties mogen de hoofdbeweging niet voortijdig resetten. Effecten decoratief, zonder pointer-events, zonder layoutverschuiving. Reduced motion schakelt hoofdbeweging én effecten uit. Controle op mobiel, clipping, meerdere herhalingen en tabwisselen. Geen verandering aan alle mascottes in de app nodig.

## 2. Afgesproken prijzen

| Pakket | Per werkruimte per maand | Per geverifieerd afgehandelde klantvraag |
| --- | ---: | ---: |
| Starter | €49 | €0,99 |
| Growth | €149 | €0,99 |
| Scale | €299 | €0,99 |

Exclusief btw. Featureverschillen bepalen het pakket, geen conceptbundels. Menselijk gecontroleerde AI-antwoorden mogen meetellen als AI-ondersteunde afhandeling. Niet elke mail of iedere klant opnieuw tellen. Content One valt buiten dit model. Proefvoorstel: 14 dagen/maximaal 50 afhandelingen zonder abonnement- of gebruikskosten, geen automatische betaalde overgang zonder instemming.

## 3. Wat technisch nog ontbreekt

- lib/planCatalog.ts verkoopt nog €79/€229/€549 met 150/500/1.500 concepten. lib/billingPlans.ts handhaaft die volumes plus 10% speling; proef is nog 150 concepten.
- lib/billing/outcomePilot.ts bevat alleen een pure schaduwberekening. Geen bewijsadapter, duurzaam register of providerafrekening.
- Checkout verkoopt één vaste prijs, quantity 1. Geen tweede gebruikscomponent of budgetinstemming.
- Stripe-webhook pakt bij subscription.updated het eerste item; prijsherkenning kent uitsluitend de drie huidige environment-ID's. Nieuwe en oude prijsversies moeten naast elkaar herkenbaar worden en het basisitem expliciet gevonden worden.
- Webhook-deduplicatie registreert vóór verwerking. Een fout daarna kan bij retry als duplicate worden overgeslagen. Nodig: retrybare verwerking met status/claim en idempotente neveneffecten; registerfouten niet stilzwijgend negeren. Dit is codeanalyse, geen vastgestelde productiestoring.
- Afhandeling vereist een inhoudelijk verstuurd antwoord, controle van de uitkomst en 72 uur observatie sinds het laatste inhoudelijke antwoord. Ontvangstbevestiging, wedervraag, spam, escalatie of fout telt niet. Stilte alleen is onvoldoende. Ontbrekende Gmail-replies buiten de app blokkeren betrouwbare automatische telling.
- Shopify heeft een eigen billingroute en blokkeert Stripe-checkout voor Shopify-billingklanten. Afzonderlijke providerimplementatie nodig; niet stilzwijgend naar Stripe verplaatsen.
- Bestaande prijzen in het echte Stripe-account, actieve abonnementen, belastinginstellingen en portalconfiguratie zijn nog NIET gecontroleerd. De zichtbare browserinventaris bevatte geen Stripe-tab; hieruit volgt niets over de accountinstellingen.

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
