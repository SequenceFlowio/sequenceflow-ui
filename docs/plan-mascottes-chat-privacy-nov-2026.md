# Plan: mascottes, centrale chat, privacy en navigatie

Datum: 5 november 2026. Status: uitvoering gestart; prijsstrategie heeft prioriteit. Eerste losse pilot-rekenmodule gebouwd; nog geen live meting of gewijzigde facturatie.
Basis: Codex-branch `codex/homepage-product-story`, productie opgehaald t/m `92ac76a` (Ezra's technische review #26). Eerst integreren en conflicten beoordelen vóór uitvoering; met name Google-callback en beveiliging. Geen productiedatabasemutaties zonder afzonderlijke toestemming.

## 1. Eerst de mascotte: drie richtingen

De huidige blob krijgt steeds accessoires zonder een duidelijke vormkeuze. Eerst één basisvorm kiezen, dan pas varianten uitwerken. Niet proberen te reconstrueren wat Elon Musk persoonlijk zou kiezen; de bruikbare referentie is de rustige productpresentatie van x.ai.

A. **Het Flow-teken — voorkeur.** Een compacte, afgeronde vorm met één kleine asymmetrische inkeping die beweging suggereert. Twee rustige ogen, geen antenne, haar of menselijk gezicht. Herkenbaar silhouet, ook zonder accessoire. Lichaam gebroken wit. Bouw als eigen SVG, geen stockillustratie.
B. **De afgeronde tegel.** Een zacht vierkant met twee ogen. Sluit aan op een werkruimte en voelt steviger dan de blob; minder speels.
C. **De eenvoudige druppel.** Een lichte, organische vorm met een kleine punt. Sterk silhouet, maar risico op een generiek water- of wellnessmerk.

Maak eerst drie kleine stilstaande studies naast dezelfde hero, op ware grootte en mobiel. Advies: A. Geen nieuwe hele pagina bouwen voordat de vorm klopt. De huidige mascotte blijft beschikbaar als vergelijkingspunt.

Hero: mascotte als rustig leesteken tussen de woorden, zonder de regelhoogte te verstoren. Eén begroeting bij verschijnen; af en toe een kanteling of korte halve draai, geen eindeloze spinner. Bij reduced motion een stilstaande versie. Geen beweging die voortdurend de tekst wegdrukt.

Familie: één basisvorm en oogstijl; onderscheid via gereedschap, gedrag en een beperkt accent. Support/Seffy: limoen + headset. Content: zacht lila + camera. Algemene assistent: neutraal, geen extra verkleedaccessoires. Voorraadexpert: gedempt blauw, eventueel dun montuur. Geen mannelijke stereotypen zoals baard of kale haren nodig.

## 2. Namen en merkhiërarchie

SequenceFlow = merk. Support One / Content One = producten. Seffy = supportpersoonlijkheid (huidige code schrijft ook Sefi; één schrijfwijze vastleggen).

Vera vervangen: **Milo** is mijn voorkeur. Kort, menselijk, vriendelijk en eenvoudig uitspreekbaar in NL/EN. Alternatieven: **Otis** (meer karakter) en **Nils** (rustiger/zakelijker). Werknaam Milo, pas definitief na keuze; beschikbaarheid en merkconflicten nog controleren. Niet claimen dat een naam uniek is.

Marktobservatie: Anthropic gebruikt Claude en Intercom gebruikt Fin. Bruikbaar principe: korte herkenbare namen, de rol apart uitleggen. Geen bewijs dat een mannennaam conversie verbetert. Vermijd namen kopiëren of nep-autonomie suggereren.

Milo blijft de naam van de voorraadexpert achter de algemene ingang. De algemene manager hoeft niet óók een aparte nieuwe naam te krijgen: in eerste instantie “Vraag SequenceFlow”. Dat voorkomt vier onduidelijke namen voor drie keuzes.

## 3. Eén zwevende chat met drie duidelijke ingangen

Badge rechtsonder blijft. Openen toont eerst een korte keuze met drie mascottes/rollen:

- **Algemeen** — “Hulp met je werkruimte, inzichten en voorraad.”
- **Klantmails · Seffy** — “Bekijk een klantvraag, antwoord of beschikbare bestelcontext.”
- **Content** — “Werk aan captions, ideeën en planning.” Status van echte beschikbaarheid zichtbaar.

Na keuze verschijnt één gesprek met de gekozen specialist bovenin en een kleine knop “Wissel onderwerp”. De keuzestap bij elk nieuw gesprek, niet opnieuw bij ieder openen van een lopend gesprek. Lopend gesprek blijft behouden; nieuwe chat begint weer met de drie keuzes. Bij wisselen geen volledige mailinhoud ongemerkt naar een andere specialist sturen.

Een korte overgang kan zeggen “Ik haal Seffy erbij”, alleen wanneer de backend werkelijk naar die rol routeert. Geen drie agents die elkaar theatraal berichten sturen. De gebruiker mag direct vragen stellen; geen technische orchestrationtermen in de UI.

Mailcontext: vanuit een geopende klantvraag een expliciete contextkaart (onderwerp, selectie, verwijderen mogelijk). Vanuit andere pagina's eerst een mail laten kiezen. Altijd huidige werkruimte en rechten server-side afdwingen. Specialist mag niets verzenden, publiceren of bestellen zonder bestaande bevestigingsstap.

Animatie: begroeting bij openen, aandachtige rustige blik bij kiezen, zoekende blik bij gegevens ophalen, subtiele bevestiging bij antwoord. Toon concrete voortgang alleen als er echte tools actief zijn. Reduced motion ondersteunen. Toetsenbord, Escape, focus-terugkeer en toegankelijke labels behouden.

### Technische werkelijkheid

`components/SupportChatWidget.tsx` laadt nu `LumenClient`; het is geen centrale router met drie specialistrollen. Voorraad heeft al eigen toolchat in `VeraChat` / inventory-API. Content Calendar is nu een aparte interne adminomgeving met gedeelde code, geen tenantgeschikte klantagent.

Daarom eerst een gedeeld chatcontract met server-side gekozen scope en toegestane tools. Gescheiden gesprekken/geheugen per rol en werkruimte. Bestaande mail- en voorraadtools hergebruiken. Content voor klanten eerst beperken tot ideeën/captions op toegestane klantdata; intern Meta-account, admincode, interne planning en publicatiecredentials nooit ontsluiten. Als dit niet klaar is: duidelijke early-access status; geen werkende Content-agent veinzen.

## 3b. Besloten 5 november: Milo is de manager, met een team van drie

Dit vervangt de drie ingangen uit hoofdstuk 3 en de rolverdeling uit hoofdstuk 2. Je praat altijd met Milo; Milo haalt een specialist erbij. De chat ziet eruit als een berichtenapp: links (op mobiel bovenin) Milo en zijn team, rechts het gesprek.

| Naam | Rol | Mascotte (houden) | Kleur | Karakter | Zegt bijvoorbeeld |
|---|---|---|---|---|---|
| **Milo** | Manager, enige ingang | antenne | wit + merkgroen (als enige groen) | De kalme verbinder: overziet alles, zegt het in één zin en eindigt altijd met één volgende stap. Kent de eigenaardigheden van zijn team en beschermt jouw tijd. Zijn antenne licht op in de kleur van wie hij erbij roept. | "Komt goed. Ik zet het uit." |
| **Seffy** | Klantmails | **koptelefoon** (blijft zeker) | warm koraal `#FFA98A` | Warm en vlot, schrijft in jouw toon. | "Hey baas! Laat mij maar." |
| **Otis** | Voorraad & inkoop (was Vera) | dun montuur | gedempt blauw `#91B8D0` | Precies en een tikje droog, rekent in dagen, niet in stuks. | "Ik heb het nageteld." |
| **Juno** | Content (early access) | **cameraatje** (blijft zeker) | zacht lila `#C4B5FD` | Nieuwsgierig en beeldend, ziet in elke klantvraag een post. | "Oeh, daar zit een post in!" |

Bij het maken van de definitieve mascottes: de koptelefoon van Seffy en het cameraatje van Juno blijven, dat vindt de eigenaar het leukst. Eén basisvorm en oogstijl voor iedereen; verschil zit in accessoire, kleur en gedrag. Alleen Milo is wit met groen; bij de teamleden krijgen randlicht én accessoire (koptelefoon, montuur, camera) hun eigen themakleur. Sefi wordt overal Seffy.

**De overdracht (kern van de ervaring):**
1. Je vraagt Milo iets. Milo zegt kort wie hij erbij haalt.
2. De specialist springt met een boogje uit de teamlijst de chat in; zijn plek in de lijst blijft als stippellijn leeg ("In gesprek met Milo…").
3. Een echte statusregel terwijl hij werkt ("Seffy leest de mail en de bestelling…"), met bijpassende blik van de mascotte.
4. Antwoord in een eigen gekleurde bubbel, met een kaart: concept-antwoord, voorraadbalken, verdeling van de inkoop of ideeën.
5. De specialist springt terug naar zijn plek; Milo sluit af. Per reeks berichten staat de specialist er maar één keer: bij een nieuw bericht hupt zijn avatar mee naar beneden, en bij vertrek verdwijnt hij uit de chat (geen klonen).

Spelregels: de sprong alleen als de server de vraag echt naar die specialist stuurt. Versturen, bestellen en publiceren altijd na een eigen klik met bevestiging. Bij "minder beweging" geen sprong, alleen de wissel. Klik op een teamlid voor zijn profiel: karakter, wat hij kan en wat hij nooit doet.

Klikbaar ontwerp met nepdata: `/design/team-chat` op `feat/centrale-chat`.

## 4. Voorraad: Vera-tab verwijderen zonder functies kwijt te raken

`InventoryClient.tsx` rendert nu `VeraTab`, met meer dan alleen chat. Eerst inventariseren: signalen, triggerregels, dagmail, wachtlijst, inkooporder en bevestigingsacties.

- Chat naar de centrale ingang Algemeen; voorraadcontext zichtbaar en door Milo beantwoord.
- Signalen en advies bij het bestaande voorraadoverzicht.
- Meldingsregels en dagmail in een compacte “Meldingen” container in Voorraad.
- Inkoop- en wachtlijstbevestigingen bereikbaar houden bij relevante signalen/centrale chat.
- Oude tablinks veilig omleiden; MCP-instructies, mails, NL/EN-teksten en helpteksten meenemen.
- Daarna pas de aparte Vera-tab uit de navigatie verwijderen. Geen API-, database- of cronverwijdering puur voor een UI-opruiming.

Homepage houdt product → voorraadverwachting → advies centraal; kleine afzender onderaan, nieuwe naam na keuze.

## 5. Cookies en privacy: echte blokkering vóór toestemming

Een banner is niet voor elke site verplicht. Functionele en beperkt privacygevoelige analytische cookies kunnen onder voorwaarden zonder toestemming; tracking vereist voorafgaande toestemming. Dit geldt ook voor vergelijkbare opslagtechnieken, niet alleen cookies.

Gevonden: `MarketingAttribution.tsx` maakt direct een sessie-ID in sessionStorage en POST bezoekevents met referrer, UTM en mogelijk gclid/fbclid. Privacytekst noemt cookies en informatie bij eerste bezoek; dit moet met de werkelijke implementatie overeenkomen. Dit is een concrete reden voor een volledige inventaris, geen automatische conclusie dat alles illegaal is.

Aanpak:
1. Inventaris van cookies, local/sessionStorage, externe scripts, embeds, marketingevents en affiliate-attributie op beide domeinen; doel, termijn, ontvanger, grondslag vastleggen.
2. Noodzakelijke auth-, beveiligings- en voorkeursopslag afzonderen. Inloggen nooit afhankelijk maken van marketingtoestemming.
3. Niet-noodzakelijke meting/advertentie-identifiers standaard uit; geen opslag of eventrequests vóór toestemming. Affiliate-attributie apart beoordelen; commercieel volgen niet stilzwijgend “functioneel” noemen.
4. Compacte NL/EN-banner: “Alles weigeren”, “Voorkeuren”, “Alles accepteren”, gelijkwaardig bereikbaar. Geen vooraf aangevinkte optionele categorieën of toestemming door scrollen.
5. Footerlink “Cookievoorkeuren”; intrekken even eenvoudig, toekomstige tracking stoppen en eigen optionele opslag opruimen. Bewaar versie, tijdstip en keuze met minimale gegevens; geen onbeperkte IP-log als bewijs.
6. Privacy-/cookieverklaring, bewaartermijnen en providers actualiseren. Aparte subdomeinkeuze expliciet testen; cookies niet zomaar domeinbreed maken.

Acceptatie: schone browsersessie weigert → geen optionele identifiers/events; accepteren activeert alleen gekozen doelen; intrekken stopt die weer; NL/EN, mobiel en auth blijven werken. Een technische implementatie is geen garantie tegen iedere boete; verklaringen en daadwerkelijk gebruik moeten blijven kloppen.

## 6. Botmisbruik en DDoS: meerdere lagen

Captcha beperkt formulierbots; het vervangt geen DDoS-bescherming. Vercel levert platformbescherming. Ezra heeft in main #26 inmiddels gedeelde Postgres-rate-limiting en routeaanpassingen toegevoegd; niet opnieuw parallel bouwen. Controleer uitvoering van migratie 065 en echte 429-responses voordat we werking aannemen. Geen migratie uitvoeren zonder toestemming.

Plan:
- Bestaande Vercel-firewallconfiguratie read-only nalopen. Gericht limieten voor publieke chat, kennismaken/contact, affiliate signup en toegangscodepogingen. Dure AI-routes ook begrenzen per werkruimte/gebruiker en kostenbudget, niet alleen IP.
- Turnstile (managed challenge) voor publieke formulieren waar nodig. Altijd server-side Siteverify, action/hostnamecontrole, verlopen/hergebruikte tokens afwijzen. Sleutels per omgeving. Toegankelijke foutmelding en opnieuw proberen; geen cosmetische checkbox zonder backendcontrole.
- Geen algemene captcha op iedere pagina. Webhooks, Google-callback, Shopify-installatie, cron en machineclients niet achter een interactieve challenge zetten; daar handtekeningen/tokens/auth gebruiken.
- Request/bodylimieten, timeouts, veilige fouten, limietlogging en alerts controleren. Secrets nooit loggen.
- Attack Challenge Mode als tijdelijke maatregel bij aanvallen; impact op echte bezoekers meenemen. Hosting-spendalerts en AI-providerbudgetten afzonderlijk.
- Test: ontbrekend/vals/verlopen token, overschrijden limiet, meerdere instanties, normale gebruiker achter gedeeld IP, OAuth en webhooks intact.

## 7. Affiliatepagina: dezelfde nieuwe navigatie en kwaliteitsronde

Affiliate gebruikt al `SitePage`, dat op deze branch naar de nieuwe `SiteNavigation` gaat. Dus eerst browserverificatie, niet nog een tweede header bouwen. Productenmenu, mobiel, actieve links, toetsenbord en footer controleren.

Verder: hiërarchie, lange formulieren, calculator, fout/succesfeedback, contrast en mobiel. Bestaande commissieregels/bedragen behouden. Leaderboard geen onnodige persoonlijke gegevens. Publieke signup rate limiting/challenge en privacyverwijzing meenemen. Affiliate-dashboardtoegang niet per ongeluk veranderen bij de visuele ronde.

## 8. Werkvolgorde en oplevering

1. Prijsfase eerst op `codex/outcome-pricing`, gestart vanaf actuele main `92ac76a`. De homepage blijft afzonderlijk op `codex/homepage-product-story`. Daarna actuele main integreren op die Codex-branch, Ezra's beveiliging en OAuth-provisioning behouden. Bestaande lokale OAuth-fix herbeoordelen en schoon testen.
2. Drie mascotstudies in dezelfde hero, voorkeur Flow-teken; Milo als naamvoorstel presenteren.
3. Privacy-inventaris en consent + publieke antimisbruiklaag als afzonderlijke gecontroleerde wijziging.
4. Affiliatepagina nalopen met gedeelde navigatie.
5. Centrale chat eerst werkend met Algemene en Mail-scope; Content alleen met veilige echte mogelijkheden/status. Daarna voorraadfuncties verplaatsen en tab verwijderen.
6. Mobiel/desktop, reduced motion, toetsenbord, NL/EN en gegevensisolatie controleren; relevante auth-/rate-limit-/tooltests uitvoeren. Geen productie-acties zoals mails versturen of posts publiceren tijdens visuele QA.
7. Per fase commit + reviewbare preview; pas na akkoord publiceren. Geen database- of infrastructuurwijzigingen verstoppen in een stylingrelease.

Aanvullend advies: maak niet overal een ander gezicht. De productuitkomst draagt de pagina; de mascotte helpt bij herkenning en voortgang. Houd early access eerlijk zolang Content geen klantproduct is.

## Bronnen (geraadpleegd 5 november 2026)

- AP, cookies: https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/internet-telefoon-tv-en-post/cookies
- AP, heldere banners: https://autoriteitpersoonsgegevens.nl/themas/internet-slimme-apparaten/cookies/heldere-en-misleidende-cookiebanners
- Rijksoverheid, toestemming: https://www.rijksoverheid.nl/themas/overheid-en-democratie/privacy-en-persoonsgegevens/vraag-en-antwoord/telecommunicatie/mag-een-website-ongevraagd-cookies-plaatsen
- Cloudflare, Turnstile en verplichte servervalidatie: https://developers.cloudflare.com/turnstile/get-started/
- Vercel DDoS: https://vercel.com/docs/vercel-firewall/ddos-mitigation
- Vercel rate limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Anthropic, Claude: https://www.anthropic.com/constitution
- Intercom, Fin: https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained

## 9. Prijsmodel: basisabonnement + werkelijk gebruik

Toegevoegd 5 november 2026 na code- en marktonderzoek. Dit is een voorstel; geen prijzen, Stripe-producten of abonnementen gewijzigd.

### Wat staat er nu?

Zowel deze branch als `origin/main` bevatten in `lib/planCatalog.ts`:

| Pakket | Catalogusprijs per maand | Inbegrepen antwoordconcepten |
| --- | ---: | ---: |
| Starter | €79 | 150 |
| Growth | €229 | 500 |
| Scale | €549 | 1.500 |

`lib/billingPlans.ts` heeft dezelfde limieten, plus 10% speling. Daarna stopt conceptgeneratie volgens de limietbeslissing. Dit is géén automatische betaling voor extra gebruik. De teller telt een uniek klantbericht met een AI-concept; opnieuw genereren voor hetzelfde bericht telt niet opnieuw, een vervolgvraag wel. Spam, genegeerde gesprekken en systeemnoodantwoorden zijn uitgesloten. Deze basis is bruikbaar.

In de doorzochte billingroutes geen geïmplementeerde meter-/overagefacturatie gevonden. Catalogusbedragen bewijzen niet dat alle actuele Stripe Price-objecten, Shopify-abonnementen en bestaande klantcontracten overeenkomen: vóór uitvoering expliciet read-only vergelijken. Ook btw-weergave en maand/jaarcontracten verifiëren.

### Markt: het principe klopt, de eenheden verschillen

- Zendesk combineert een prijs per medewerker met inbegrepen en aanvullende automatische oplossingen. Niet simpelweg een bedrag per ontvangen mail. Bron: https://www.zendesk.com/pricing/
- Intercom combineert platform-/seatprijzen met Fin-gebruik; standaard $0,99 per outcome. Een outcome is niet hetzelfde als een gegenereerd concept en wordt maximaal één keer per gesprek gerekend. Bron: https://www.intercom.com/pricing en https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-outcomes
- Gorgias koppelt helpdeskvolume aan tickets en rekent AI afzonderlijk bij opgeloste gesprekken. Het beschrijft expliciet situaties waarin een ticket én automation meetellen. Bronnen: https://www.gorgias.com/pricing en https://helpcenter.gorgias.com/en-US/how-youre-billed-for-using-gorgias-199385

Conclusie: een vaste basis plus gebruik is passend. Hun outcomeprijs rechtstreeks vergelijken met onze conceptprijs is misleidend: bij ons kan een mens het antwoord nog aanpassen en versturen.

### Definitief gekozen richting, voorlopige tarieven

De eerdere conceptbundels en tarieven van €0,49 zijn vervallen als voorstel. De bestaande productiecontracten blijven wel intact tot een expliciete overgang. Nieuwe richting: featurepakketten met dezelfde gebruiksprijs, per afgehandeld gesprek, niet per mail of unieke persoon.

| Pakket | Vaste maandprijs | Per afgehandeld gesprek |
| --- | ---: | ---: |
| Starter | €49 | €0,99 |
| Growth | €149 | €0,99 |
| Scale | €299 | €0,99 |

Exclusief btw, per werkruimte/winkel. Testprijzen, geen bewezen optimale prijzen. Starter: inbox, kennisbank, antwoordstijl en menselijke controle. Growth: extra automatisering, workflows en inzichten. Scale: samenwerking, rechten en prioriteitsondersteuning; functies eerst aantoonbaar beschikbaar maken. Geen tien pakketten of volumegrenzen die het outcome-model alsnog tot conceptbundels maken. Content One krijgt een afzonderlijk model vanwege andere kosten.

Voorbeeld Starter: 50 afhandelingen = €98,50; 100 = €148; 500 = €544. Zonder afhandelingen blijft de basisprijs verschuldigd buiten de proefperiode. Daarom niet adverteren met een ongekwalificeerd “alleen betalen bij resultaat”.

### Wat moet eerst gebouwd en besloten worden?

1. Eén heldere factuureenheid publiceren, met concrete voorbeelden. Huidige conceptmeting uitsluitend behouden voor bestaande contracten; een afzonderlijke outcomemeting bouwen; defecte/mislukte resultaten moeten gecorrigeerd kunnen worden. Niet claimen “alleen opgeloste vragen” zolang we dat niet betrouwbaar meten.
2. Extra gebruik standaard uit totdat eigenaar expliciet instemt met tarief en maandplafond. Waarschuwingen vóór grens (bijv. 80% en 100%), actuele kosten en verbruik op facturatiepagina. Geen onverwachte rekening, geen automatische pakketupgrade.
3. Huidige 10% gratis speling expliciet kiezen: in de nieuwe betaalde regeling vervangen door een duidelijke inbegrepen/extra-grens; niet tegelijk stilzwijgend gratis én betaald tellen. Bestaande contracten tot overgang behouden.
4. Duurzaam, idempotent verbruiksregister met unieke broneenheid, werkruimte, factuurperiode, tariefversie, correcties en providerreceipt. Huidige teller is een quota-instrument; historische herclassificatie mag geen oncontroleerbare factuurmutaties geven.
5. Stripe-route: passende usage/meterfacturatie, belastingen, facturen, retries en deduplicatie. Shopify-route: apart volgens Shopify-billingvoorwaarden en goedgekeurd usageplafond; niet aannemen dat Stripe voor iedere Shopify-installatie gebruikt mag worden. Actuele providerdocumentatie opnieuw raadplegen bij uitvoering.
6. Test webhook-herhaling, dubbele pipelineverwerking, spamcorrectie, hergeneratie, follow-up, periodegrens, upgrading/downgrading, refunds en bereikte kostenlimiet. Bij plafond geen mails verliezen: zichtbaar wachten, handmatig afhandelen mogelijk houden.
7. Bestaande klanten niet stilzwijgend omzetten. Nieuwe tariefvoorwaarden en overgangsmoment expliciet; landingspagina, checkout, app, factuur en voorwaarden moeten overeenkomen.

Uitvoeringsvolgorde: eerst meter en kostencontrole valideren, daarna billing in testmodus, daarna vrijwillige pilot. Pas dan publieke prijspagina aanpassen. Geen bedragen live beloven voordat incasso en limieten echt werken.

### Onderbouwing van de gekozen afhandelingseenheid

Gebruiker bedoelt outcome pricing, niet betaling per concept. De voorlopige tarieven staan hierboven; kosten en pilots moeten deze nog valideren.

De genoemde 72 uur komt daadwerkelijk voor in Zendesk-documentatie over het model vóór resolution tiers. Voor legacy e-mail/webform: 72 uur inactiviteit, relevante generatieve reactie, positieve of geen feedback, geen menselijke reactie en AI-verificatie. Dezelfde pagina beschrijft voor andere agents ook een evaluatiemoment 72 uur na de eerste e-mail. Dus geen universele actuele Zendesk-regel; channel en versie verschillen. Sinds 18 mei 2026 bestaat een nieuw tiers-model. Bron: https://support.zendesk.com/hc/en-us/articles/5352026794010-About-the-automated-resolutions-platform-prior-to-resolution-tiers

Voorstel eigen, expliciete regeling:
- Per gesprek over één klantvraag, niet per unieke klant en niet per antwoord. Geen dubbele telling bij hergeneratie of meerdere mails over hetzelfde probleem.
- Wachtstatus na inhoudelijk antwoord dat daadwerkelijk is verstuurd. 72 uur sinds het laatste inhoudelijke antwoord zonder terugkerende onopgeloste klantvraag, én controle op inhoudelijke afhandeling. Een ontvangstbevestiging of alleen een wedervraag telt nooit als oplossing. Stilte alleen bewijst geen succes.
- Terugkerende vraag vóór definitief tellen hervat het gesprek en de beoordeling. Spam, fouten en escalaties niet factureren. Beleid voor heropening ná tellen/correcties vóór lancering vastleggen; oude vraag niet als nieuwe oplossing dubbeltellen.
- Gekozen richting: menselijke goedkeuring telt als AI-assisted afhandeling, mits inhoudelijk gecontroleerd. Ons huidige product begint met controle door een mens. “Volledig automatisch opgelost” is dan geen correcte claim. Onderscheid desgewenst AI-afgehandeld en AI-ondersteund; maak vóór bouw één heldere contractuele definitie.
- Ontbrekende zichtbaarheid op menselijke replies buiten de app (zoals rechtstreeks in Gmail) maakt automatische uitkomstfacturatie onbetrouwbaar. Eerst aantonen dat relevante vervolg- en uitgaande berichten worden meegenomen; anders geen outcome factureren op basis van alleen stilte.
- Bouw eerst shadow metering: uitkomsten tonen/handmatig controleren zonder afrekening. Daarna pilot met maandplafond en inzicht per geteld gesprek. Huidige conceptenteller niet hernoemen naar opgeloste gesprekken: dat is een ander meetmodel.


### Hormozi vertaald naar Support One (besproken en uitvoering gevraagd)

Dit is onze toepassing van zijn raamwerken, niet een persoonlijke prijsaanbeveling van Alex Hormozi. Geraadpleegd: officieel materiaal bij $100M Offers en $100M Money Models; geen claim dat de volledige boeken integraal zijn gelezen.

- **Resultaat en vertrouwen:** verkoop minder werk aan klantvragen, onderbouw dat met echte pilotmetingen. Toon bronnen, uitzonderingen en menselijke controle. Geen gegarandeerde besparing verzinnen.
- **Snelheid en inspanning:** begeleid de eerste pilots bij mailbox, winkelbeleid en eerste echte klantvraag. Onboarding is onderdeel van het aanbod; niet direct een verplichte extra setupfactuur. Later de kosten hiervan evalueren.
- **Aanbod:** “Laat Support One je klantvragen voorbereiden. Probeer het 14 dagen met je eigen mailbox, je eigen winkelbeleid en controle over ieder antwoord. Wij helpen je op weg.”
- **Proefperiode:** voorstel 14 dagen, maximaal 50 afhandelingen, geen abonnement- of gebruikskosten tijdens de proef. Technische limiet nog implementeren; huidige productieproef niet stilzwijgend wijzigen. Geen betaalde overgang zonder instemming.
- **Risico:** maandbudget, waarschuwingen, controleerbare gesprekken en correcties. Geen garantie op 80% tijdwinst, geen nepbonuswaarden, geen automatische facturatie op basis van stilte.
- **Metingen:** tijd zonder/met hulp, kwaliteit, correcties, actieve winkels, conversie, retentie en totale kosten inclusief AI-retries, ondersteuning, infrastructuur en betaalprovider. Meetkosten zijn een ondergrens; betalingsbereidheid en klantwaarde bepalen de commerciële ruimte.
- **Prijstest:** start met één helder instapaanbod €49 + €0,99. Groei-/Scale-prijzen als voorstel behouden, pas verkopen wanneer featureverschillen bewezen zijn. Geen willekeurige individuele prijsverschillen tijdens dezelfde pilot.

Bronnen:
- https://www.acquisition.com/training/offers4
- https://www.acquisition.com/hubfs/Offer%20Checklists%20-%20PDF%20Downloads/Bonus-Creation-Checklist.pdf
- https://www.acquisition.com/hubfs/Offer%20Checklists%20-%20PDF%20Downloads/Unbeatable-Guarantee-Checklist.pdf
- https://www.acquisition.com/training/money/offer-types

### Uitvoering prijsfase — Bezig: Codex (`codex/outcome-pricing`)

1. **Gereed als geïsoleerd fundament:** `lib/billing/outcomePilot.ts`, versiegebonden tarieven in eurocenten, conservatieve afhandelingsbeoordeling en rapportberekening. Testgevallen in `tests/outcome-pilot.test.ts`. Elk rapport rekent daadwerkelijk nul af; maandbedragen zijn uitsluitend ramingen. Geen productiedata gelezen/gewijzigd en geen betaalprovider aangeroepen.
2. **Nog te bouwen:** adapter van werkruimtegebonden mails/conversaties naar bewijs, inclusief replies buiten de app. De module verwacht gecontroleerde input; een caller mag zichtbaarheid of afhandeling niet zomaar op “confirmed” zetten. Geen model dat zijn eigen antwoord zonder onafhankelijke controle tot betaalbaar resultaat verklaart.
3. **Nog te bouwen:** duurzaam shadow-register, factuurperiodeselectie, correcties en heropening, UI met reden per gesprek. Eén gesprek kan meerdere losse problemen bevatten: de case-identiteit eerst valideren. De huidige caseId-/previouslyCounted-input is geen persistent idempotentieregister.
4. **Nog te valideren:** eerdere replies buiten de app en de nieuwste synchronisatie. Zonder volledige dekking geen betaalbare uitkomst. Menselijk goedgekeurd AI-antwoord heet AI-ondersteund, nooit volledig autonoom.
5. **Daarna:** pilot met handmatige controle en kostenmetingen, akkoord op eenheidsdefinitie en tarieven, provider-testmodus, maandbudgetten, bestaande contracten beschermen, publieke teksten en checkout gezamenlijk aanpassen. Databasewijzigingen uitsluitend met expliciete toestemming.

Overige planonderdelen (cookies, antimisbruik, affiliate, mascottes en centrale chat) blijven open en volgen na deze prioriteitsfase. Homepagewerk is niet meegenomen in deze aparte branch. Geen prijzen live gewijzigd.
