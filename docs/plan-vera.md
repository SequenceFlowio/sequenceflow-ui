# Plan van aanpak: Vera, de voorraadassistent

Stand van 3 november 2026. Vera is een assistent op de Voorraad-pagina (`/inventory`). Ze staat los van de algemene chat rechtsonder: die is voor algemene vragen, Vera werkt met de voorraaddata. Ze geeft uit zichzelf seintjes (triggers en mails), en later kun je met haar chatten en laat ze dingen uitvoeren.

## Besluiten (Ezra, 2 nov)

- **Naam:** Vera. Ze schrijft in de ik-vorm en ondertekent als "Vera, Voorraadassistent van Support One".
- **Rechten:** ze mag dingen aanpassen, maar alleen na een bevestiging van de gebruiker (een kaart met een knop "Bevestig"). Zonder bevestiging leest ze alleen.
- **Mail:** hoogstens één mail per dag met wat nieuw is, plus het weekoverzicht op maandag. Dat weekoverzicht bestaat al en staat nu op naam van Vera.
- **Volgorde:** eerst de triggers en de mails (fase 1), dan de chat met leesrechten (fase 2), dan acties en de inkooporder (fase 3).
- **Open vraag aan Ezra:** zijn bericht van 2 nov stopte bij "en eventueel nadenken voorm…". Vraag wat hij daar bedoelde voordat je aan fase 2 begint.

## Afspraken in deze repo (gelden voor elke stap)

- **Repo:** `SequenceFlowio/sequenceflow-ui` op GitHub (de live site, support.sequenceflow.io). Fase 1 staat op branch `feat/vera-alerts`.
- **Migratienummers:** kijk altijd eerst welke nummers op main al bestaan (`git ls-tree --name-only origin/main supabase/migrations/`). Main heeft 058 en 059 al; inkoopadvies gebruikt nu 060 (seizoenen) en 061 (Vera). De volgende vrije is 062.

- Lees eerst `AGENTS.md`. Je bouwt op een `feat/*`-branch. Een push naar `main` gaat live. Aan de productiedatabase kom je alleen met expliciete toestemming van Ezra; migraties draait hij zelf in de Supabase SQL-editor.
- **De AI rekent niets.** Alle cijfers komen uit de pure functies in `lib/inventory/core.ts`, `reportCore.ts` en `alertsCore.ts`. De AI mag cijfers alleen herhalen en in woorden zetten. Zie `introIsGrounded` in `lib/inventory/emailCore.ts` voor hoe we controleren dat een AI-tekst geen eigen getallen verzint.
- **AI:** gebruik OpenAI via `getOpenAIClient()` (`lib/openaiClient.ts`), model `gpt-4.1-mini`, zoals in `lib/inventory/email.ts`. Leg het verbruik vast met `recordAiUsage` en een `idempotencyKey`.
- **Alleen voor Scale:** elke route gaat via `inventoryContext()` uit `lib/inventory/routeHelpers.ts`. Die regelt de feature-vlag, het pakket en de rol (alleen een admin mag iets wijzigen).
- **Tests:** `npm test` (node --test). `tests/content-calendar-planning.test.ts` faalt lokaal ook op main, omdat `date-fns` ontbreekt; dat hoort niet bij dit werk. Verder: `npx tsc --noEmit -p .` en `npx eslint <bestanden>`.
- **Teksten:** Nederlands eerst, Engels ernaast (`nl ? … : …`). Kort en concreet, zonder jargon.
- **Demo:** `scripts/seed-inventory-demo.ts` maakt een verzonnen winkel. Die staat al op deadtheon@gmail.com en sequenceflownl@gmail.com. Zo heb je data om mee te testen.

## Afhankelijkheid: PR #24 (seizoenen) moet eerst

[PR #24](https://github.com/SequenceFlowio/sequenceflow-ui/pull/24) (`feat/season-dead-stock`) staat nog open. Daarin zitten:
- seizoensproducten: status `off_season`, `seasonMonths` en `seasonSource` per variant, handmatig instellen onder Instellingen;
- migratie 060 (`060_inventory_product_seasons.sql`). Die heette eerst 058, maar main heeft al `058_content_calendar.sql` en `059_referrals_affiliates.sql`.
- de reparatie van bol ontkoppelen.

Fase 1 bouwt daarop voort (branch `feat/vera-alerts` is vanaf `feat/season-dead-stock` gemaakt). Merge #24 eerst, na akkoord van Ezra, en laat Ezra migratie 060 draaien.

## Fase 1: triggers en mails — gebouwd, wacht op test en akkoord

Gecommit op `feat/vera-alerts` (3 nov). De PR naar main komt van `claude/beautiful-keller-pxmysq`, die daarop voortbouwt. Stand 3 nov: 330 tests, tsc en eslint groen; droge test van de triggers op de demo-winkel geeft 14 meldingen (zie `scripts/seed-inventory-demo.ts`). Nog niet in de browser getest; migratie 060 en 061 nog niet gedraaid.

### Wat er staat

| Bestand | Wat |
|---|---|
| `supabase/migrations/061_inventory_alerts.sql` | Tabellen `inventory_alert_rules` en `inventory_alerts`, plus kolommen `alert_email`, `alert_rules_seeded` en `last_alert_email_at` op `inventory_settings`. RLS zoals in 057. Nog niet gedraaid. |
| `lib/inventory/alertsCore.ts` | Puur. 8 soorten triggers (`ALERT_KINDS`), met per soort een label, grens en toegestane scope (`ALERT_KIND_INFO`). De standaardregels, `evaluateAlerts(report, rules, language)`, `diffAlerts` en de mailtekst `alertEmail`. |
| `lib/inventory/alerts.ts` | Database. `loadAlertRules` (maakt eenmalig de standaardregels aan), `refreshInventoryAlerts` (opent nieuwe meldingen, sluit opgeloste) en `sendInventoryAlertEmail` (max 1 per dag, afzender "Vera van Support One"). Plus `alertsUnavailable()`, zodat de sync blijft werken zolang migratie 061 niet gedraaid is. |
| `app/api/inventory/alerts/route.ts` | GET: regels, open meldingen en de opgeloste van de laatste 30 dagen. POST: nieuwe regel. PATCH: aan/uit of grens. DELETE `?id=`. Na elke wijziging wordt meteen opnieuw gecontroleerd, zonder mail. |
| `app/api/cron/inventory/route.ts` | Na de sync: `refreshInventoryAlerts` en daarna `sendInventoryAlertEmail`. Werkruimtes zonder winkel maar met voorraaddata (de demo) krijgen alleen `rebuildInventoryReport` en de triggers. |
| `app/api/inventory/sync/route.ts` | "Nu bijwerken" controleert de triggers meteen. De mail wacht op de nacht. |
| `app/api/inventory/settings/route.ts`, `lib/inventory/sync.ts`, `app/api/inventory/route.ts` | Instelling `alertEmail`, los ingelezen zodat het zonder migratie niet breekt. Wordt meegegeven in `sync.alertEmail`. |
| `lib/inventory/email.ts`, `emailCore.ts` | Het weekoverzicht is nu van Vera: afzendernaam, aanhef en ondertekening. `veraFrom()` en `adminEmails()` worden gedeeld. |
| `app/(app)/inventory/VeraTab.tsx` + `InventoryClient.tsx` | Tabblad "Vera" met drie delen: wat ze nu ziet, de regels (aan/uit, grens, verwijderen, eigen regel voor alles, één product of één variant), en de schakelaar "Mail me". |
| `tests/inventory-alerts.test.ts` | 10 tests voor alle soorten triggers, `diffAlerts`, de grenzen en de mail. Ze slagen. |

### De triggers

| Soort | Grens (standaard) | Staat standaard aan |
|---|---|---|
| `sold_out`: uitverkocht terwijl er vraag is | geen | ja |
| `questions_on_short`: klanten vragen naar iets dat (bijna) op is | 3 vragen | ja |
| `sales_spike`: deze week ×N een normale week (de 83 dagen ervoor), en minstens 5 verkocht | 2× | ja |
| `season_ahead`: het seizoen begint binnen N weken en er moet bijbesteld worden (per product, één keer per seizoensstart) | 6 weken | ja |
| `delivery_late`: een ingevoerde levering is N dagen over de datum zonder voorraadsprong | 3 dagen | ja |
| `stock_below`: voorraad onder N stuks | 10 | nee, eigen regel |
| `days_below`: minder dan N dagen voorraad | 14 | nee, eigen regel |
| `dead_stock_value`: dode voorraad boven € N (voor de hele winkel) | € 5.000 | nee, eigen regel |

Hoe het ontdubbelen werkt: elke melding heeft een `fingerprint` (regel, variant en soms een extra deel). Zolang dezelfde fingerprint terugkomt, blijft het één open melding. Komt hij niet meer terug, dan wordt de melding gesloten (`resolved_at`). Een unieke index op de open meldingen voorkomt dubbele meldingen.

### Nog te doen voor fase 1

1. ~~Draai `npm test`, `tsc` en `eslint` opnieuw.~~ Gedaan op 3 nov: 330 tests, tsc en eslint groen.
2. ~~Commit op `feat/vera-alerts`.~~ Gedaan. Rebase op main zodra #24 gemerged is.
3. Test het lokaal of op de Vercel-preview van de PR met een Scale-account dat de demo heeft (deadtheon):
   - het tabblad Vera laadt;
   - de standaardregels verschijnen;
   - een eigen regel "Voorraad onder 10 stuks voor Essential Hoodie · M / Zwart" geeft meteen een melding;
   - de schakelaar "Mail me" werkt.

   Eerst moet Ezra migratie 061 draaien (na 060); zonder die migratie toont het tabblad "nog niet beschikbaar".
4. Controleer de mail: zet tijdelijk `last_alert_email_at` op gisteren, of roep `sendInventoryAlertEmail` aan in een script tegen een testwerkruimte. De mail moet van "Vera van Support One" komen en elke melding moet erin staan. Stuur niets naar echte klanten zonder akkoord.
5. ~~Werk `docs/inkoopadvies.md` bij met een stuk over Vera, en zet in `docs/roadmap.md` bij punten 5, 6 en 7 "Bezig: …" met je branch.~~ Gedaan (punt 6 staat als "na fase 3", want dat is mail naar eindklanten).
6. ~~Open een PR.~~ Gedaan. Merge en zet live pas na akkoord van Ezra; migratie 060 en 061 staan in de PR.

Wat er bewust niet in zit: meldingen in de app buiten het tabblad (een badge in de zijbalk). Dat is een kleine toevoeging voor later: tel `inventory_alerts` met `resolved_at IS NULL`.

## Fase 2: chatten met Vera (alleen lezen)

**Doel:** in het tabblad Vera een chatpaneel waarin je vragen stelt over je voorraad. Bijvoorbeeld: "welke maten van de hoodie moet ik bijbestellen voor de feestdagen?", "wat staat er vast in dode voorraad bij de jurken?", "maak een lijst van alles wat uitverkocht is met de klantvragen erbij". Vera antwoordt met cijfers uit de tools, in tabellen of lijstjes.

**Opzet:**
- **Route:** `POST /api/inventory/vera/chat` met `{ messages }`. Kijk hoe `app/api/lumen/chat/route.ts` en `lib/lumen/chat.ts` berichten valideren (`parseLumenMessages`: hoogstens 12 berichten van hoogstens 4.000 tekens), en doe hetzelfde.
- **Tools:** OpenAI function calling, met alleen deze leestools. Ze zijn allemaal dun laagje over bestaande functies; zie `lib/mcp/tools.ts`, daar staan al drie inventory-tools met dezelfde vorm (`compactVariant`).
  - `get_inventory_health` → `reportView(report, { status: "attention", limit: 50 })`: samenvatting, acties en klantvragen.
  - `list_variants` (status, zoekterm, kanaal, limiet) → `filterMetrics` + `sortMetrics` + `compactVariant`.
  - `get_season_sales` (van, tot) → `loadSeasonReport`.
  - `get_deliveries` → `report.deliveries`.
  - `get_alerts` → open meldingen en regels uit `inventory_alerts` en `inventory_alert_rules`.
  - `get_products` → `productSeasons(report)`.
- **Systeemprompt:**
  - Vera spreekt Nederlands (of de taal van `tenant_agent_config.language_default`) en is kort en concreet.
  - Ze noemt alleen getallen die in de tooluitvoer staan. Weet ze iets niet, dan zegt ze dat.
  - Ze verwijst naar het tabblad waar je het ziet.
- **Grounding:** controleer achteraf dat alle getallen in het antwoord in de tooluitvoer voorkwamen, net als `introIsGrounded`. Zo niet, vraag het model één keer om het te herschrijven, of toon het antwoord met een waarschuwing. Leg vast wat de controle oplevert.
- **Verbruik:** `recordAiUsage` met operation `inventory_assistant`, en per gebruiker een limiet, bijvoorbeeld 60 berichten per dag. Billable of niet: vraag Ezra.
- **Geschiedenis:** begin zonder opslag, alleen in de browser zoals Lumen. Bewaren in een tabel kan later.
- **UI:** in `VeraTab.tsx` boven de meldingen, met een invoerveld en voorbeeldvragen als knoppen. Een antwoord mag markdown-tabellen bevatten: render die veilig, zonder `dangerouslySetInnerHTML` met ruwe tekst.
- **Tests:** puur testbaar zijn de toolkeuze, de grounding-check en het valideren van berichten. Haal de OpenAI-aanroep achter een functie die je in tests vervangt.

**Klaar als:**
- op de demo-winkel geven vijf voorbeeldvragen kloppende antwoorden;
- geen enkel getal staat niet in de tools;
- een gebruiker onder Scale krijgt 403;
- tests, tsc en lint zijn groen.

## Fase 3: acties na bevestiging, en de inkooporder

**Doel:** Vera kan iets voorstellen, en voert het uit nadat de gebruiker op Bevestig drukt.

**Schrijftools** voeren niets zelf uit. Ze geven een voorstel terug (`{ action, params, summary }`), dat de UI als kaart toont. Bevestigen roept het bestaande endpoint aan, met de rechten van de ingelogde gebruiker; alleen een admin kan bevestigen:
- levering invoeren → `POST /api/inventory/deliveries`;
- seizoen van een product instellen → `PATCH /api/inventory/settings` met `productSeason`;
- trigger toevoegen of aanpassen → `POST`/`PATCH /api/inventory/alerts` (bijvoorbeeld "laat me weten als de zwarte hoodie M onder de 10 komt");
- inkoopinstellingen wijzigen (levertijd, buffer) → `PATCH /api/inventory/settings`.

**Concept-inkooporder** (roadmap punt 16):
- Vera stelt per leverancier een lijst op: variant, SKU/EAN, aantal (`recommendedOrder`) en inkoopprijs (`unit_cost`).
- Je kunt hem als CSV downloaden, of als mailconcept naar de leverancier zetten. Dat is alleen een concept; versturen doet de gebruiker zelf.
- Daarvoor zijn leveranciers nodig: een tabel `inventory_suppliers` (naam, e-mail, levertijd, minimale bestelhoeveelheid) en een koppeling van producten aan een leverancier. De levertijd per leverancier vervangt dan de ene levertijd van de winkel in `orderQuantity` (`lib/inventory/core.ts`). Bespreek dit eerst met Ezra; het is het grootste stuk van fase 3.

**Klaar als:** elke actie een bevestigingskaart heeft; zonder klik verandert er niets; een niet-admin ziet de kaart maar kan niet bevestigen; de inkooporder klopt met het advies op de pagina.

## Ideeën voor later (niet beginnen zonder akkoord)

- Wachtlijst "weer op voorraad" uit de supportvragen (roadmap punt 6): als een uitverkochte variant binnenkomt, mailt Vera de klanten die ernaar vroegen. Dat is mail naar eindklanten, dus apart beslissen.
- Triggers op marge en GMROI zodra die berekend worden, en een trigger op het retourpercentage per maat.
- Vera's meldingen ook via MCP (`get_inventory_alerts`) voor Claude en ChatGPT.
