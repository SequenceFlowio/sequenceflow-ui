# Support One — product-, website- en technische audit

22 september 2026 · Rapport vóór implementatie

## Mijn oordeel

**Behoud de visuele richting en de mascotte. Bouw de landingpage inhoudelijk opnieuw op rond aantoonbare supporttaken. Los eerst de falende kenniszoekfunctie en Lumen op, en versterk de verzendbetrouwbaarheid voordat je automatische afhandeling nadrukkelijk verkoopt.**

De donkere achtergrond, limoenaccenten, grote typografie en headsetmascotte vormen een herkenbare basis. Je gevoel over de inhoud klopt: de huidige pagina vertelt vooral dat Support antwoorden maakt. Ze laat onvoldoende zien waarom een webshop dit zou vertrouwen, welke werkzaamheden verdwijnen en hoe je uitzonderingen onder controle houdt.

Er zit meer product in de repository dan de website overbrengt: ordercontext, kennis, menselijke beoordeling, voorstellen om van correcties te leren en operationele inzichten. Tegelijk lopen sommige demonstraties vóór op de beschikbare functionaliteit. Dat verschil moet kleiner worden.

Dit is geen oordeel dat een nieuwer model alles opnieuw moet bouwen. De grootste winst zit in duidelijkere productkeuzes, betere bewijsvoering en betrouwbaardere verwerking.

## Onderzoek en grenzen

| Onderdeel | Onderzocht |
|---|---|
| Productiewebsite | Landingpage, prijs-/doelgroeppagina's, login, metadata en publieke crawl-endpoints |
| Browserervaring | Gerenderde schermen, demo-/mascotteanimaties, navigatie en smallere browserweergave |
| Referentie | [x.ai/bot](https://x.ai/bot): sectieopbouw, demonstraties, mascotte en wisselende usecases. `/bots` gaf tijdens het onderzoek geen werkende referentiepagina |
| Ingelogde app | Home, Inbox, Integraties, Commerce, Kennisbank, Agent Profiel, Analytics en Lumen |
| Interactieve controles | Twee Lumen-vragen en twee kenniszoekvragen; geen klantmails verstuurd |
| Code | Lokale `main` op `22b10f4` en Claude's `feat/marketing-motion` op `5d3eba5`, inclusief de bijbehorende worktree |
| Tests | Bestaande suite op Claude's worktree: **148 geslaagd, 0 gefaald** |

De live vormgeving sluit aan op Claude's wijzigingen, maar de exacte productiecommit is niet vastgesteld. De bestaande tests bevatten ook controles op broncodepatronen; ze bewijzen geen werkende productie-integraties. Er is geen nieuwe build, Lighthouse-meting of volledige toegankelijkheidsaudit uitgevoerd.

De geïnspecteerde werkruimte had geen supportgesprekken en geen volledig ingerichte inkomende/uitgaande mailbox. Daarom zijn ontvangst, ticketafhandeling, verzending, automatisch versturen en billing **niet end-to-end bewezen**. De bol-koppeling leverde wel echte gesynchroniseerde commercegegevens. De UI vermeldde polling als actieve fallback en aandacht voor events.

Desktop en een smallere weergave van circa 597 px zijn bekeken. Een aangevraagde 390px-viewport werd door de browser niet betrouwbaar toegepast; ik claim daarom geen afgeronde telefoontest. De mobiele CSS is wel onderzocht.

Er zijn geen appcode, productie-instellingen, koppelingen of klantgegevens gewijzigd. Alleen de interne testvragen zijn uitgevoerd en dit rapport is toegevoegd.

## Prioriteiten

P1 = aanpakken vóór nadrukkelijker promoten of opschalen van de betreffende functie. P2 = eerstvolgende verbeteringsronde. P3 = verdere verfijning.

| Prioriteit | Bevinding | Bewijs | Gewenst resultaat |
|---|---|---|---|
| P1 | Kennis zoeken faalt ondanks twee gereed gemelde documenten | Beide live zoekvragen eindigden in `Knowledge retrieval is temporarily unavailable.` | Werkende retrieval en aparte gezondheidscontrole naast documentstatus |
| P1 | Lumen geeft geen antwoord | Twee verschillende eenvoudige vragen gaven dezelfde generieke fout | Werkend antwoord, bronverwijzingen en diagnoseerbare foutafhandeling |
| P1 | Risico op dubbel verzenden bij overlap/herhaling | Code: controle vóór verzending, statusupdate erna, geen zichtbare atomische claim in handmatig/cron-pad | Duurzame verzendtaak, claim, idempotentie en herstel van onzekere afleverstatus |
| P1 | Bronstoring kan als lege kennis doorgaan naar antwoordgeneratie | Code: retrieval-fout wordt in reply-context `[]` | Storingen expliciet onderscheiden; review afdwingen wanneer benodigde bronnen uitvallen |
| P1 | Demo suggereert beschikbare WooCommerce-integratie | Live demo versus providerconfiguratie: WooCommerce en Shopify uitgeschakeld | Demonstratie met werkelijk ondersteunde koppeling of expliciet toekomstbeeld |
| P2 | Robots en sitemap leiden naar login | Live publieke requests en authenticatieproxy | Publieke, correcte `robots.txt` en XML-sitemap |
| P2 | Mobiele navigatie verdwijnt | CSS: navigatie uit onder 980 px, inloggen uit onder 640 px; geen vervangend marketingmenu | Menu met inloggen, functies en prijzen |
| P2 | App-home toont marketingdemo's tussen echte appnavigatie | Live Home en `MockEmailCard` in code | Echte werkstatus en eerstvolgende actie, demo apart gelabeld |
| P2 | Witte informatiekaart met zeer lichte tekst | Live bol-instellingen en hardgecodeerde lichte achtergrond | Leesbaar contrast in beide thema's |
| P2 | USP's zijn grotendeels tekstueel en overlappend | Live landingpage | Eén duidelijke taak en zichtbaar bewijs per sectie |
| P3 | Mascottebeweging is relatief druk en draait ook buiten beeld | Browserobservatie en animatiecode | Rustiger karakter, beweging gekoppeld aan de taak, pauzeren buiten beeld |

De eerste twee fouten zijn tijdens deze sessie gereproduceerd. Ze bewijzen niet dat alle klanten hetzelfde ervaren. De onderliggende oorzaken zijn zonder gerichte backenddiagnose nog onbekend; ik schrijf ze niet automatisch toe aan een model, API-sleutel of Supabase-configuratie.

## Waarom de xAI-pagina sterker voelt

Het verschil zit vooral in **een concrete belofte met direct ernaast een kleine productdemonstratie**. De grote mascotte is een herkenningspunt binnen dat verhaal. Afwisseling tussen brede panels, compacte kaarten en selecteerbare voorbeelden houdt de pagina interessant.

Support One heeft nu één uitgebreide inboxdemo, gevolgd door meerdere tekstblokken die ongeveer dezelfde voordelen herhalen. Daardoor daalt het bewijsgehalte na de hero.

| Wat werkt bij de referentie | Vertaling naar Support One |
|---|---|
| Groot productmoment vroeg op de pagina | Klantvraag → relevante bron → concept → menselijke beslissing |
| Eigen mini-interface per vaardigheid | Bestelling zoeken, retourbeleid toepassen, ontbrekende informatie herkennen |
| Herkenbare demonstraties met verschillende taken | Tabs voor bezorging, retourvraag en productvraag |
| Karakter tussen de productsecties | Headsetmascotte die naar een bron kijkt of een antwoord ter beoordeling aanbiedt |
| Geheugen/leren tastbaar gemaakt | Correctie → voorgestelde regel → team keurt regel goed |
| Samenhang tussen belofte en visueel bewijs | Elk voordeel verbinden aan een bestaande functie én duidelijke grens |

Ik zou het ritme en de bewijsvoering overnemen, met eigen composities en supportvoorbeelden. Bots die zelfstandig allerlei apps bedienen of samenwerken zijn geen huidige Support One-belofte. Ook is uit een website niet af te leiden wie het ontwerp persoonlijk heeft gemaakt.

## Voorstel: nieuwe landingpage, inclusief inhoud

Onderstaande tekst is een inhoudelijk ontwerp. Claims over kennis en Lumen kunnen pas definitief live wanneer de genoemde problemen zijn opgelost. Voorbeelden zijn gelabelde demonstraties, geen echte klantcases.

### 1. Hero — een direct begrijpelijke rol

**Je AI-collega voor de supportinbox.**

*Support One combineert klantvragen met je bedrijfskennis en beschikbare bestelgegevens. Je team beoordeelt het concept en houdt controle over wat er wordt verstuurd.*

Primair: **Probeer 14 dagen gratis**. Secundair: **Bekijk een voorbeeld**.

Behoud de huidige concrete trialvoorwaarden. Vermijd een universele belofte dat elke mail een goed antwoord krijgt. Dat is juist bij ontbrekende informatie of storingen te absoluut.

Visueel: één korte, leesbare flow met een klantvraag, twee echte bronsoorten en een concept. Toon de ondersteunde integratie. Vervang `96% zeker` door bijvoorbeeld **Concept klaar voor controle**; een modelschatting is geen gemeten kans op juistheid.

### 2. Brede USP — bestelcontext zonder zoekwerk

**De bestelling erbij. Zonder tussen schermen te wisselen.**

*Gebruik beschikbare bol-bestel- en verzendgegevens bij het beoordelen van een klantvraag. Zo begint je team met context, in plaats van met zoeken.*

Visueel: klant vraagt naar bezorging; een orderkaart schuift naast de mail; verzendstatus en datum van laatste update worden zichtbaar; de mascotte kijkt naar die bron.

Toon ook een ontbrekende transportscan. Een scan in een sorteercentrum bewijst niet dat het pakket vandaag aankomt. De huidige demo maakt die sprong wel.

### 3. Brede USP — bedrijfsbeleid toepassen

**Een antwoord dat rekening houdt met jouw beleid.**

*Voeg je retourbeleid, verzendinformatie en productkennis toe. Support gebruikt relevante informatie om een passend concept te maken.*

Visueel: retourvraag → gemarkeerde passage uit een voorbeeldbeleid → antwoord. Bronidentiteit per passage in de inbox is nog een productverbetering: de reply-context geeft nu vooral samengevoegde tekst door. Presenteer die gewenste interactie niet alsof zij al volledig bestaat.

### 4. Brede USP — controle zichtbaar maken

**Jij bepaalt wanneer een antwoord de deur uitgaat.**

*Begin met concepten die je team beoordeelt. Schakel automatisch versturen pas in voor de werkwijze die je hebt gecontroleerd.*

Visueel: twee routes. Een duidelijk verzoek krijgt een concept; een onduidelijke vraag gaat naar een medewerker. Het beoordelingsmoment staat centraal.

Automatische verzending bestaat, maar heeft voorwaarden en tijdvensters. Vermijd de indruk dat elke vraag direct en volledig autonoom wordt afgehandeld. Versterk eerst broncontroles en verzendbetrouwbaarheid.

### 5. Twee compacte kaarten — stijl en bestaande mailbox

**Maak van correcties duidelijke afspraken.**

*Support kan verbeteringen voor je antwoordstijl en werkwijze voorstellen. Je team bepaalt welke afspraken actief worden.*

Visual: medewerker wijzigt een formulering → voorgestelde regel → goedgekeurd. Dit sluit aan op de code voor leervoorstellen. “De AI traint zichzelf” is hiervoor een misleidende omschrijving.

**Werk verder met je huidige supportadres.**

*Koppel je mailbox en richt het versturen vanaf je supportadres in. Een begeleide controle helpt je zien wat al werkt en wat nog nodig is.*

Visual: provider kiezen → ontvangen controleren → verzenden controleren. Verberg IMAP/SMTP niet wanneer nodig, maar laat ze niet het verhaal op de landingpage bepalen. Een absolute belofte dat iedere fallback je eigen afzender behoudt, klopt niet met alle onderzochte codepaden.

### 6. Interactieve voorbeelden — drie taken

Tabs: **Waar is mijn bestelling? · Hoe werkt retourneren? · Productinformatie**.

Elke tab toont dezelfde eenvoudige structuur: klantvraag, beschikbare context, concept en wat een medewerker moet beoordelen. Voeg ook een voorbeeld toe waarin informatie ontbreekt. Zo demonstreer je kwaliteit zonder overal perfectie te veinzen.

Geen automatische refund, annulering of Shopify/WooCommerce-logo als beschikbare integratie: die functionaliteit is in de onderzochte providerconfiguratie niet actief.

### 7. Inzichten — een interessante tweede belofte

**Zie welke vragen steeds terugkomen.**

*Bekijk welke onderwerpen je inbox vullen en waar informatie ontbreekt. Gebruik die inzichten om je support en productinformatie te verbeteren.*

Begin met aantoonbare analytics. Voeg Lumen toe wanneer de antwoordflow werkt. Bij weinig data: expliciet onvoldoende gegevens, zoals delen van Analytics nu al netjes doen. Geen verzonnen percentages of bespaarde uren.

### 8. Bewijs, proberen en bezwaren

Eindig met een echte pilotcase zodra die bestaat: periode, aantal gesprekken, percentage bruikbare concepten, benodigde aanpassingen en antwoordtijd. Tot dan is een eerlijke demo sterker dan fictieve testimonials.

Daarna een compact prijsoverzicht en FAQ over mailboxcompatibiliteit, menselijke controle, ontbrekende informatie, gegevensgebruik en opzeggen. Eén laatste CTA. Publiceer geen meetbare resultaatsclaims zonder onderbouwing.

## UI en mascotte

**De huidige mascotte houden.** De headset maakt de supportrol direct duidelijk. De eenvoudige ogen en zachte vorm passen bij het product. Een nieuwe mascotte levert minder op dan betere plaatsing en gedrag.

- Laat hem drie functionele houdingen hebben: lezen, iets ter beoordeling aanbieden en rustig wachten. Een vierde subtiele reactie kan een ontbrekende bron aangeven.
- Behoud het af en toe rechtzetten van de headset; maak het snelle willekeurige rondkijken rustiger. De code wisselt de blik in rust al na 380–1150 ms. Dat kan onrustiger overkomen dan een behulpzame collega.
- Behoud de grote uitsnede in één sterke sectie. Op mobiel wordt die nu volledig verborgen onder 760 px; maak daar een kleinere compositie van.
- Geef limoen vooral aan acties, voortgang en belangrijke markeringen. Niet elk accent hoeft tegelijk om aandacht te vragen.
- Verklein het logo in de app-sidebar of herstructureer het lockup: de naam raakte in de bekeken desktopweergave afgesneden. Een groter logo is niet in elke context beter.
- Herstel de marketinghoverkleur: `.mk-nav a:hover` en `.mk-login-link:hover` worden zwart op donker.
- Maak Nederlandse benamingen en datumnotatie consequent. Termen als “tenant”, “chunks”, “Agent DNA”, ruwe transportcodes en technische herstelstatussen horen onder aanvullende details.

### Animaties

De bestaande basis is bruikbaar: gefaseerde inboxdemo, subtiele reveals, headsetgebaar en ondersteuning voor verminderde beweging. De demo gebruikt al zichtbaarheid om fasen te stoppen buiten beeld.

De volledige democyclus duurt volgens de code circa 12,2 seconden. Het complete antwoord blijft ongeveer 3,2 seconden staan. Dat is kort om de inhoud te beoordelen. Laat de demo één keer afspelen en daarna op het resultaat blijven staan, met **Opnieuw bekijken** en scenarioselectie.

Voeg pauze toe voor langdurige automatisch bewegende content; respecteren van reduced motion is nuttig maar dekt niet alle behoeften. Zie de [WCAG-uitleg over pauzeren, stoppen en verbergen](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

De mascotte gebruikt meerdere doorlopende animatielussen, ook voor exemplaren buiten beeld of verborgen via CSS. Pauzeer die via zichtbaarheid en bij een verborgen browsertab. Meet daarna het effect; er is nu geen gemeten performanceprobleem vastgesteld.

Maak de demoknoppen echt bruikbaar binnen het voorbeeld, of presenteer ze duidelijk als illustratie. Nu ogen ze klikbaar maar doen ze niets. Controleer ook de toegankelijkheidsboom: visueel nog verborgen demofasen zijn daarin al aanwezig.

## Dashboard en onboarding

### Een werkplek in plaats van een tweede verkooppagina

Home bevat voorbeeldmails, marketingzinnen en gesimuleerde activiteit terwijl de echte inbox leeg is. Plaats een rondleiding achter een duidelijke demoknop. Laat Home de echte stand tonen: verbinding, bruikbare kennis, te beoordelen gesprekken en eerstvolgende stap.

Inbox toont tegelijk meerdere setupwaarschuwingen en vervolgens “Geen nieuwe klantvragen”. Bij een niet aangesloten mailbox is een betere boodschap: **Koppel je mailbox om hier klantvragen te ontvangen.** Eén checklist met één primaire vervolgstap voorkomt dat de gebruiker tussen instellingen moet puzzelen.

### Voorstel voor de eerste ervaring

1. Toon een duidelijk gelabelde voorbeeldvraag, zodat de gebruiker het resultaat begrijpt.
2. Laat de gebruiker zijn mailprovider kiezen. Geef een passende route in plaats van direct een algemeen serverformulier.
3. Controleer ontvangen en verzenden afzonderlijk, met begrijpelijke status en herstelactie.
4. Voeg een beleidsdocument toe en voer een echte testvraag uit.
5. Maak een eerste eigen concept. Laat de gebruiker het controleren voordat automatisering ter sprake komt.

Twee documenten met status gereed bewijzen geen beleidsdekking of werkende zoekfunctie. Toon daarom bijvoorbeeld **Documenten verwerkt**, **Zoektest geslaagd** en **Retourbeleid gecontroleerd** als verschillende zaken.

Analytics doet iets goed: steekproefgrootte en gebrek aan bewijs worden op meerdere plekken zichtbaar gemaakt. Maak de lege toestand compacter. Hernoem een metric die alleen automatisch verstuurde berichten telt niet naar “Auto-opgelost”; oplossen vraagt een aanvullende definitie, bijvoorbeeld geen heropening binnen een afgesproken periode.

Commerce is nuttige operationele bewijsvoering. Laat recente synchronisatie, datadekking en ontbrekende scans zien. Vertaal providerstatussen naar mensentaal en leg uit dat polling een werkende fallback kan zijn, in plaats van alle aandachtspunten even ernstig te laten lijken.

### Google: je bezwaar is reëel, maar er zijn verschillende routes

Google-login voor identiteit staat los van mailboxrechten. Voor Gmail zijn lezen, wijzigen en drafts beheren via onder meer `gmail.readonly`, `gmail.modify` en `gmail.compose` **restricted scopes**. Bij server-side verwerking kunnen verificatie en security assessment van toepassing zijn. Alleen `gmail.send` is volgens de scope-tabel **sensitive**, niet restricted. Zie [Google's officiële Gmail-scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) en [restricted-scope-verificatie](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

| Route | Sterkte | Beperking |
|---|---|---|
| Huidige IMAP/SMTP, beter begeleid | Aansluiting op bestaande implementatie | Technische stappen; Gmail-appwachtwoord niet voor ieder account beschikbaar |
| Forwarding + onderzoek naar Gmail send-only OAuth | Inkomende mail via forwarding, concept in Support One, Gmail alleen voor verzenden | Nog steeds OAuth-verificatie; geen volledige inboxhistorie of Gmail-drafts; totale architectuur moet op beleid worden getoetst |
| Volledige Gmail-integratie | Potentieel prettigste geïntegreerde ervaring | Restricted scopes en bijbehorende beoordeling/budget |
| Microsoft OAuth als aparte route | Providergerichte ervaring voor Microsoft-klanten | Eigen implementatie en organisatiebeleid rond toestemming |

Mijn advies: verbeter eerst de huidige begeleiding, onderzoek daarna send-only OAuth met forwarding als afgebakende optie. Dit is geen garantie dat alle beoordeling vervalt. Gmail-appwachtwoorden vereisen tweestapsverificatie en zijn in bepaalde accounts niet beschikbaar; ontwerp een alternatief pad. Zie [Google over appwachtwoorden](https://support.google.com/accounts/answer/185833). Voor Microsoft moeten de benodigde gedelegeerde rechten en tenantregels worden uitgewerkt; zie [Microsoft Graph-permissies](https://learn.microsoft.com/en-us/graph/permissions-reference).

De door Claude beschreven localhost-redirect is plausibel, maar zonder Supabase-configuratie geen bevestigde diagnose. Productielogin werkte voor deze audit; er was geen wijziging in productie-auth nodig. Voor lokale/previewontwikkeling moeten zowel toegestane redirects als de originselectie in de app kloppen. Zie [Supabase redirect-URL's](https://supabase.com/docs/guides/auth/redirect-urls).

## SEO

De homepage is publiek bereikbaar. Toch ontbreekt een aantal belangrijke basisvoorzieningen.

| Vastgesteld | Aanpak |
|---|---|
| `/robots.txt` en `/sitemap.xml` eindigen op login-HTML | Beide bestanden implementeren en buiten auth houden; correcte contenttypes en publieke 200-responses |
| Geen canonical op onderzochte pagina's | Eigen absolute canonical per indexeerbare pagina |
| Open Graph gebruikt nog SequenceFlow Commerce Support | Support One consequent maken in titel, social metadata en afbeelding |
| `og:url` verwijst ook op andere routes naar de root | Paginaspecifieke URL's |
| Login mist expliciete noindex | Login en private appmetadata uitsluiten van indexering; authenticatie blijft de echte toegangscontrole |
| Geen structured data aangetroffen | Passende Organization/SoftwareApplication-data op basis van echte productgegevens; geen rich-resultbelofte |
| Doelgroeppagina's weinig zichtbaar gelinkt | Goede interne links en opname in sitemap; voorkom bijna identieke SEO-pagina's |

Een ontbrekende sitemap betekent niet dat Google de site helemaal niet kan indexeren. Canonicals helpen Google de voorkeursversie begrijpen; zie [Google over canonicalisatie](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

Begin inhoudelijk bij echte koopvragen: AI-support voor bol-verkopers, supportmails voorbereiden, retourvragen beantwoorden met bedrijfsbeleid en mailbox aansluiten. Maak alleen integratiepagina's voor wat beschikbaar is, of markeer toekomstige beschikbaarheid nadrukkelijk.

Voeg Search Console en betrouwbare conversiemetingen toe. Meet naast aanmelden ook mailbox aangesloten, kenniszoektest geslaagd, eerste concept beoordeeld en eerste antwoord verstuurd. De OAuth-callback registreert momenteel `signup_completed` op een plek die ook terugkerend inloggen kan omvatten; maak de definitie expliciet.

Er zijn geen echte Core Web Vitals verzameld. Gebruik velddata en een mobiele labmeting voordat je performanceclaims doet.

## Technische werking en nieuwe inzichten

### Verzendbetrouwbaarheid

De handmatige goedkeurroute controleert de gespreksstatus, verstuurt en schrijft daarna de nieuwe status weg. De cron heeft eveneens verzending vóór de afsluitende statusupdate. Zonder een gezamenlijke atomische claim kunnen overlappende uitvoeringen hetzelfde gesprek oppakken. Een willekeurige nieuwe Message-ID per poging voorkomt dat niet.

Maak één duurzame outbox voor handmatig en automatisch versturen, met een unieke logische verzendopdracht, een claim en traceerbare pogingen. Een netwerkfout na acceptatie door SMTP is een onzekere uitkomst; blind overschakelen naar Resend kan dan dubbel verzenden. Ontwerp daarvoor reconciliatie en een zichtbaar herstelpad. SMTP biedt niet vanzelf een garantie op precies één aflevering.

Dit zijn codebevindingen, geen tijdens de audit verstuurde dubbele mails. Relevante bestanden: `app/api/tickets/[id]/approve-send/route.ts`, `app/api/cron/autosend/route.ts`, `lib/email/outbound/mailer.ts`, `lib/email/outbound/messageId.ts` en `lib/resend.ts`.

### Kwaliteit begint bij beschikbare bronnen

`retrieveKnowledgeContext` gebruikt een codepad waarin een retrieval-fout een lege lijst wordt. Daardoor kan antwoordgeneratie het verschil verliezen tussen geen passende bron en een defecte bronvoorziening. Dat is nu extra relevant omdat de live kenniszoektest daadwerkelijk faalt.

Geef bronstatus expliciet door. Dwing menselijke beoordeling af wanneer voor een antwoord benodigde kennis of ordergegevens niet beschikbaar zijn. Een simpele vraag zonder behoefte aan die bron hoeft niet automatisch geblokkeerd te worden. Toon actualiteit en ontbrekende context bij het concept.

### Verwerking bij groei

De IMAP-cron heeft een tijdslimiet van 60 seconden en verwerkt mailboxen/berichten sequentieel, met maximaal twintig nieuwe berichten per mailbox. AI-verwerking binnen die keten kan bij groei zorgen voor vertraging en timeouts. Dit is een schaalrisico uit de code, geen gemeten incident.

Splits ontvangst en verwerking in herstartbare taken per bericht, met checkpoints, begrensde gelijktijdigheid, retries en zichtbare achterstand. Bestaande deduplicatie is nuttig, maar vervangt geen herstel van gedeeltelijk verwerkte taken.

### Een nieuwer model inzetten

De hoofdroute gebruikt `gpt-4.1-mini`. Mijn advies is geen blinde modelwissel. Bouw eerst een evaluatieset met geanonimiseerde of synthetische bezorg-, retour-, product-, meertalige en onvolledige vragen. Neem tegenstrijdige bronnen en instructies in klantmails mee.

Vergelijk kandidaten op feitelijke juistheid, naleven van beleid, passende escalatie, benodigde menselijke correctie, latency en kosten. Routeer eventueel complexere gevallen naar een sterker model als die meting het rechtvaardigt. Een door het model opgegeven confidencepercentage is op zichzelf geen gekalibreerde kwaliteitsmeting.

De aanwezige fundamenten zijn bruikbaar: tenantgebonden gegevens, beoordeling door mensen, expliciete leervoorstellen en controles rond commerceacties. Commerceacties zijn momenteel per provider uitgeschakeld; houd dat onderscheid helder tussen architectuur en verkoopbare functie.

## Voorgestelde uitvoervolgorde en acceptatie

| Stap | Werk | Klaar wanneer |
|---|---|---|
| 1. Functionele basis | Retrieval en Lumen diagnosticeren en herstellen | Relevante testvragen werken; ontbrekende bronnen en storingen geven passende uitkomsten |
| 2. Betrouwbaar versturen | Gezamenlijke outbox, claims, retries, brongezondheid | Overlap en onzekere netwerkuitkomsten leiden niet tot blind opnieuw verzenden; herstel is zichtbaar |
| 3. Geloofwaardige presentatie | WooCommerce-demo, confidenceclaim en fictieve Home-activiteit corrigeren | Alle publieke beloften corresponderen met beschikbare en geteste functies |
| 4. Snelle UX-/SEO-winst | Mobiel menu, hover/contrast, canonicals, robots, sitemap | Publieke endpoints kloppen; belangrijke routes zijn bruikbaar op telefoon en met toetsenbord |
| 5. USP-landingspagina | Bovenstaande secties, scenario's en rustigere animaties | Elk voordeel heeft begrijpelijk bewijs; demo blijft leesbaar en pauzeerbaar |
| 6. Activatie | Providerwizard, echte kenniscontrole, eerste concept | Nieuwe gebruiker bereikt aantoonbaar een eigen bruikbaar concept |
| 7. Uitbreiden op bewijs | Modelevaluatie, pilotcase, OAuth-onderzoek | Verbeteringen onderbouwd met kwaliteit, activatie en operationele meetgegevens |

**Mijn voorkeursvolgorde: eerst de basis betrouwbaar maken, daarna het sterke productverhaal zichtbaar maken. De huidige huisstijl en mascotte kunnen daarbij blijven.**
