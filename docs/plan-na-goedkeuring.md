# Plan: zodra Google en Shopify iets laten horen

Status (19 okt 2026): Google en Shopify hebben allebei goedgekeurd. Fase C staat open. Opgesteld op 14 okt 2026 door Claude, voor Claude en Codex.

**Werkafspraak:**
- Wie een stap oppakt, zet bovenaan die stap "Bezig: Claude" of "Bezig: Codex".
- Is de stap af, dan wordt dat "Klaar" met de datum.
- Zo doet niemand dubbel werk.
- Alles wat productie raakt, alleen met een akkoord van Navaron: Vercel-variabelen, domeinen, de Shopify- en Google-consoles.

## Waar we op wachten

| Partij | Wat | Sinds | Hoe je het merkt |
|---|---|---|---|
| Google | Verificatie van de app voor `gmail.send` (project `support-one-mail-511020`, client "Support One web") | 13 okt 2026 | Mail van Google, of in Google Cloud → Google Auth Platform → Verification center de status "Verified" |
| Shopify | App-review van "SequenceFlow Support" | begin okt 2026 | Mail van Shopify App Review, of in het Dev Dashboard verandert de status "In review" |
| Noctis (klant) | Mailboxwachtwoord bij Hostinger opnieuw invullen (sinds 8 okt AUTHENTICATIONFAILED) | 8 okt 2026 | `tenant_email_channels.imap_status` van tenant 52d5c6db staat weer op `active` |

## A. Google keurt goed

**Bezig: Claude (18 okt 2026).**
- Klaar: Google Cloud meldt dat branding en gegevenstoegang geverifieerd zijn.
- Klaar: `GOOGLE_SEND_TENANT_IDS` is uit Production verwijderd, dus iedereen kan nu inloggen met Google.
- Klaar: getest als nieuwe klant op de demowinkel `sequenceflow-demo`. Inloggen met Google werkt zonder waarschuwingsscherm.
- Gevonden en opgelost (75a6ce8): de Shopify-app gaf willekeurig 401 "Not authenticated" door klokverschil bij het sessietoken.

1. **Controleren.** Log in met Google vanuit de app (Mailbox → "Inloggen met Google"). Het scherm "Google hasn't verified this app" mag niet meer verschijnen.
2. **Vergrendeling eraf**, na akkoord van Navaron:
   - Zet in Vercel (project `supportflow`, Production) `GOOGLE_SEND_TENANT_IDS` leeg of verwijder hem. Leeg betekent: iedereen.
   - Zet daarna een nieuwe deploy live; een variabele werkt pas na een nieuwe deploy.
3. **Testen als nieuwe klant.** Open de Shopify-app op de testwinkel `sequenceflow-nieuwe-klant` (tenant 4f96b62c):
   - Onder Mailbox staat nu "Connect Gmail without a password".
   - Doorloop inloggen, doorsturen en een testmail.
4. **Demovideo Gmail opnemen.** Zie [plan-setup-demovideo.md](plan-setup-demovideo.md), video 1. Dat kan pas nu, want het waarschuwingsscherm moet weg zijn.

## B. Shopify keurt goed

**Klaar: Claude, 19 okt 2026.** Shopify keurde de app goed op 19 okt (mail "Congratulations! Your app has been approved").
- Listing gepubliceerd op https://apps.shopify.com/sequenceflow-support. Op 26 okt op verzoek van Navaron op **"Fully visible"** gezet: vindbaar in de zoekresultaten en aanbevelingen, zonder extra review. De optionele rechten (B3) hebben ook geen nieuwe review gestart.
- App-icoon (mascotte, donker olijf) geüpload in Dev Dashboard → App settings → App icon. De listing synchroniseert vanzelf.
- De installatie via de route van een nieuwe klant is op 18 okt volledig doorlopen op `sequenceflow-demo`.

1. **App-icoon vervangen**, na akkoord: upload `docs/brand/shopify-app-icon.png` (1200×1200, mascotte "B4 donker olijf") in het Dev Dashboard → app → App listing → App icon.
2. **Instellingen nalopen in Vercel (Production):**
   - `SHOPIFY_PUBLIC_ROLLOUT=true` blijft staan.
   - `SHOPIFY_BILLING_TEST_SHOPS` bevat alleen onze eigen testwinkels (`sequenceflow-test`, eventueel `sequenceflow-nieuwe-klant`). Nooit een winkel van een reviewer of van een betalende klant.
3. **Echte installatie testen** vanaf de openbare App Store-pagina, op een testwinkel:
   - installeren;
   - "No, start fresh";
   - een plan kiezen, waarna de proefperiode zichtbaar moet zijn;
   - mailbox koppelen;
   - het voorbeeldconcept bekijken.

## B2. Shopify keurt af

**Bezig: Claude (18 okt 2026).**
- De afkeuring van 15 okt noemt één punt, 4.5.3 "Include a demo screencast". De reviewers konden de app niet volledig opzetten en testen. Ze willen een stap-voor-stap video, in het Engels of met Engelse ondertitels, van de onboarding en alle kernfuncties.
- Waarschijnlijke oorzaak: "Inloggen met Google" stond toen alleen open voor onze eigen werkruimtes, dus een reviewer kon geen mailbox koppelen zonder app-wachtwoord. Dat slot is er nu af (zie A).
- Tweede oorzaak: de ingediende testinstructies noemden nog de knop "Get started", die niet meer bestaat.
- Klaar (18 okt):
  - Nieuwe Engelse video (2:20), live op https://support.sequenceflow.io/media/shopify-review-demo.mp4. Maken met `scripts/render-shopify-review-video.mjs`; de ruwe screenshots staan buiten de repo.
  - Nieuwe testinstructies in `docs/shopify-app-store-submission.md` §2.
- **Klaar: opnieuw ingediend op 18 okt 2026**, met akkoord van Navaron.
  - Screencast URL en testinstructies zijn vervangen.
  - Feedback 4.5.3 is als opgelost gemarkeerd; de video geldt als bewijs.
  - Status: "In review — We're reviewing your response".
- Volgende stap: wachten op Shopify. Bij goedkeuring verder met B (icoon uploaden, installatie testen) en daarna C.

- Lees de redenen in de mail. Bekend risico: tot 14 okt bleef de app na het kiezen van een plan op "Choose a plan" hangen. De proefperiode werd niet herkend, en dat is opgelost in commit `cf3dd87`.
- Herstel wat Shopify noemt en test het op `sequenceflow-nieuwe-klant`.
- Dien opnieuw in, met in het antwoord aan de reviewer kort wat er veranderd is.

## B3. Producten en voorraad in de Shopify-app

**Klaar: 26 okt 2026, live.** De app had alleen `read_orders`, dus geen producten en voorraad.
- Uitgerold:
  - migratie 054 op productie;
  - PR #9 gemerged (`64a53e3`);
  - app-versie `sequenceflow-support-3` released met de optionele rechten.
- Getest op `sequenceflow-test`:
  - "Toegang geven" toont Shopify's venster "View products"; na Update staat de regel op groen.
  - Bestelling #1002 met een echt product kreeg een snapshot met voorraad 9, prijs 24,95 USD en for sale = ja.
  - Een custom item (zoals #1001 "Testtrui blauw") heeft geen variant en krijgt dus terecht geen voorraad.
- Open kleine punten uit de review:
  - bij afremmen door Shopify valt de voorraadinfo van alle blokken weg;
  - alleen de eerste 20 orderregels krijgen voorraad;
  - de regel blijft op "Status laden…" als App Bridge geen scopes-functie heeft.
- Klaar in de code: `read_products` en `read_inventory` zijn optionele rechten (`shopify.app.toml`). Bestaande winkels blijven werken; de eigenaar geeft de toegang zelf via Overzicht → "Producten en voorraad" → "Toegang geven".
- Met die toegang haalt de app per bestelde variant de voorraad, prijs, barcode en beschikbaarheid op. Die gaat als offer-snapshot (`provider = 'shopify'`) naar de AI-context en Lumen, net als bij bol.com.
- Live zetten, in deze volgorde:
  1. Migratie `054_shopify_offer_snapshots.sql` op productie draaien.
  2. De PR mergen naar `main` (Vercel).
  3. `npx @shopify/cli app deploy` vanuit de repo, zodat Shopify de optionele rechten kent.
  4. Op `sequenceflow-test` in de app op "Toegang geven" klikken, een bestelling ophalen en in een concept controleren dat de voorraad erbij staat.

## C. Fase B van de website (pas als zowel Google als Shopify akkoord zijn)

Achtergrond:
- Sinds 14 okt toont www.sequenceflow.io de Support One-site, vanuit dezelfde app (`lib/site.ts`, `proxy.ts`).
- support.sequenceflow.io toont daarnaast nog steeds de landingspagina, omdat Google en Shopify die adressen nu beoordelen.

1. **Doorsturen.**
   - Op support.sequenceflow.io gaan de marketingpagina's met een 308 naar `https://www.sequenceflow.io`, met hetzelfde pad. Het gaat om `/`, `/pricing`, `/for/*`, `/blog*`, `/contact` en de juridische pagina's.
   - De app-pagina's blijven op support.sequenceflow.io: inloggen, inbox, instellingen, `/shopify`, `/api`, `/auth`, `/link-shopify`.
   - Bouw dit in `proxy.ts`, als spiegel van de bestaande regel voor sequenceflow.io.
2. **Google.**
   - Pas de homepage-, privacy- en voorwaarden-URL's in de branding aan naar www.sequenceflow.io.
   - Doe dat alleen als Google daarvoor geen nieuwe beoordeling start. Start Google wel een nieuwe beoordeling, laat de oude URL's dan staan; ze sturen netjes door.
3. **Shopify.** Zet de privacy- en support-URL's in de App listing op www.sequenceflow.io. De app-URL (`support.sequenceflow.io/shopify`) en de redirect-URL's blijven zoals ze zijn.
4. **Google Search Console.** Dien `https://www.sequenceflow.io/sitemap.xml` in.

## D. Opruimen (na akkoord, niets verwijderen)

- Archiveer het oude Vercel-project `website`. Het heeft sinds 14 okt geen domeinen meer.
- Archiveer de GitHub-repo `SequenceFlowio/Sequence-Flow`.
- Later, met juridische blik: voeg `/privacy` (de app) en `/privacyverklaring` (het bedrijf) samen tot één privacyverklaring.

## Handig om te weten

- **Deploys:** een push naar `main` gaat live via Vercel. Wacht op de deploy met `vercel ls supportflow --prod --format json -m githubCommitSha=<sha>` en daarna `vercel inspect <url> --wait`.
- **Migraties:** Claude mag ze zelf draaien (vaste toestemming van Navaron). Een migratie die data verwijdert, vraagt eerst een korte melding.
- **Domein- en DNS-wijzigingen** in Vercel worden in de automatische modus van Claude geblokkeerd. Zet de juiste pagina open en laat Navaron klikken.
