# Plan van aanpak: werkstroomkern Support One

Datum: 22 november 2026. Bouwer: Claude (`feat/*`-branches per stap). Review: Codex, alleen-lezen, verplicht bij alles wat de mailpipeline, auto-send, geld of rechten raakt.
Achtergrond: Playbook V2 – SequenceFlow (https://claude.ai/artifact/6eQtcZ4uVGDhd8zhqwnAMg) en SequenceFlow – strategie 2027 (https://claude.ai/artifact/PZ2ex3PC5p3hayRyg7HHEg).

**In één zin:** auto-send beslist straks niet meer op hoe zeker het model zegt te zijn, maar op een gemeten reeks per winkel en soort vraag plus feitenchecks in code. Elke wijziging aan prompt of model moet eerst een testset met het echte model halen.

## Doel

**Op 15 januari 2027 beslist auto-send voor elke winkel op de vertrouwensladder plus feitenchecks, en is de oude drempel weg.** De lat voor de testset is 100% zonder kritieke fouten, in drie runs op rij; elke fase voegt gevallen toe.

| Datum | Mijlpaal | Meetbaar |
| --- | --- | --- |
| 29 nov 2026 | Fase 0 klaar | Testset 3 runs op rij 100%; modelnamen op één plek; stiltebewaking actief in `/intern` |
| 6 dec 2026 | Fase 1 klaar, fase 2 in schaduw | Elke nieuwe beslissing heeft een soort uit de vaste lijst; testset heeft de soort in minstens 90% goed; feitencheck legt vast wat hij zou tegenhouden |
| 13 dec 2026 | Fase 3 in schaduw | Ladderstand per winkel en soort zichtbaar; bij elke beslissing staat wat de ladder zou doen |
| 20 dec 2026 | Feitencheck aan; ladder aan voor ons eigen testaccount | Nul valse blokkades in testset en eigen account |
| 10 jan 2027 | Ladder voor alle winkels | Twee weken eigen account zonder fout |
| 15 jan 2027 | Fase 4: vervanging | Geen codepad meer dat alleen op de zekerheid van het model automatisch verstuurt |

Er komt nu weinig echte mail binnen. De schaduwperiodes leunen daarom op de testset en ons eigen testaccount; komen er winkels bij, dan meten we ook op hun verkeer.

## Einddoel (de huidige live-situatie volledig vervangen)

- Auto-send gebeurt alleen als (1) de winkel voor die soort vraag op trede 2 of hoger van de vertrouwensladder staat en (2) alle feitenchecks slagen. Zekerheid van het model is alleen nog een extra vangnet.
- Elke wijziging aan prompt, model of pipeline draait vooraf de live testset (`npm run eval:support`) en zet de score in de PR.
- Stiltebewaking meldt binnen een uur als mail, crons of koppelingen uitblijven, en blijft melden tot het is opgelost.
- Modelnamen staan op één plek (`lib/ai/models.ts`).
- Het oude pad (`autosend_threshold` als enige poort), de schakelaars en de schaduwkolommen zijn opgeruimd.

## Uitgangssituatie (gecontroleerd op 22 november)

| Onderwerp | Stand |
| --- | --- |
| Verkeer | 111 beslissingen in totaal, 81 goedgekeurd of verstuurd, 15 door een mens aangepast, 23 leergebeurtenissen, 7 werkruimtes met beslissingen |
| Mail binnen | Sinds 5 november bij geen enkele werkruimte. Eén Pro-werkruimte heeft sinds 8 oktober een IMAP-inlogfout; de dagelijkse waarschuwingsmail loopt, maar niemand heeft het opgelost |
| Auto-send nu | `confidence >= autosend_threshold` (standaard 0,85) in `lib/pipeline/runInboundEmailPipeline.ts`; per werkruimte aan of uit, niet per soort vraag |
| Controle nu | Schema (`validateDecision`), statuscheck (`lib/commerce/claims.ts`: geen verzonden, geannuleerd of terugbetaald zonder bewijs), annuleren alleen via voorstel, golden set met vaste modelantwoorden (`tests/decision-golden.test.ts`, 14 gevallen) |
| Ontbreekt | Live test mét kennis en bestelgegevens (er was alleen een kale live test op 6 golden-gevallen, `scripts/eval-decisions.ts`, nu opgegaan in `eval:support`); check op datums, trackinglinks, bedragen en bestelnummers; vaste lijst soorten vraag (nu vrije tekst, bijvoorbeeld `order_status_inquiry` naast `klacht beschadiging product`) |
| Leren | `learn-from-edits` maakt voorgestelde lessen van correcties; nano draait in de schaduw mee bij de spamcheck |
| Afrekenen | Live per afgehandeld gesprek (`lib/billing/handledConversations.ts`): gecontroleerd €0,47, zelfstandig €0,97, na 72 uur zonder terugkeer van de klant. Elke trede omhoog op de ladder verdubbelt dus ook de opbrengst per gesprek |
| Privacy | De verwerkersovereenkomst sluit gebruik voor eigen doeleinden en AI-training uit. De testset begint daarom met verzonnen gevallen bij fictieve winkels |

## Fases

Elke fase heeft een eigen branch, staat in `docs/roadmap.md` met "Bezig", en kan terug met een schakelaar. Migraties voegen tot en met fase 3 alleen iets toe.

### Fase 0: brandstof en zicht (geen gedragswijziging)

| Stap | Wat | Klaar als | Wie |
| --- | --- | --- | --- |
| 0a | Ons eigen testaccount opnieuw end-to-end testen via Gmail-doorsturen | Er komt mail binnen en er ontstaat een concept | Navaron en Claude |
| 0b | Live testset en runner | `npm run eval:support` draait minstens 30 verzonnen gevallen tegen het echte model en rapporteert per verwachte soort vraag en de kosten | Klaar (22 nov, PR #136); nulmeting 27/30 |
| 0b+ | De drie bevindingen uit de nulmeting oplossen: klacht naar een mens, geen verzonnen "annuleren kan niet", om het bestelnummer vragen zonder gekoppelde bestelling | Testset 100% | Claude (`feat/prompt-regels`) |
| 0c | Modelnamen op één plek | Geen modelnaam meer los in routes; testset en golden set gelijk | Claude (`feat/modelnamen`): alle modellen in `lib/ai/models.ts`; de oude kale live test (`scripts/eval-decisions.ts`) zit nu als zes gevallen in `eval:support` |
| 0c+ | Gevonden met de testset: de statuscheck draaide niet zonder webshopkoppeling, en sloeg vals alarm op voorwaarden ("zodra het is verzonden") en ontkenningen ("nog niet is verzonden") | Check draait altijd; alleen stellige zinnen tellen | Claude (`feat/modelnamen`) |
| 0d | Stiltebewaking: elk uur een check (`/api/cron/silence`, regels in `lib/ops/silenceCore.ts`), melding in `/intern` en elke dag een mail aan de beheerders tot het is opgelost | Een kapotte mailbox, vastgelopen verzending, lege postbuffer of ontbrekende cijfers staat binnen een uur in `/intern` | Claude (`feat/stiltebewaking`) |

### Fase 1: vaste soorten vraag

- Vaste lijst (uitgangspunt: `order_status`, `shipping`, `return_request`, `damaged`, `missing_items`, `warranty`, `complaint`, `cancellation`, `payment`, `product_question`, `compliment`, `fallback`, plus de bestaande `non_customer_*`) in prompt en `validateDecision`; onbekend wordt `fallback`.
- Historie: een afgeleide kolom of view die oude vrije tekst naar de lijst vertaalt.
- Klaar als: elke nieuwe beslissing een soort uit de lijst heeft en de testset de soort in minstens 90% van de gevallen goed heeft.

### Fase 2: feitencheck uitbreiden (eerst schaduw)

- Elk bestelnummer, elke datum, trackinglink en elk bedrag in een concept moet in de commerce-context staan.
- Eerst alleen vastleggen bij de beslissing (wat de check zou blokkeren), na twee weken zonder vals alarm aanzetten: concept naar een mens.
- Klaar als: de testset gevallen met een verzonnen datum of bedrag bevat die worden tegengehouden, en de schaduwperiode geen valse blokkades liet zien.

### Fase 3: vertrouwensladder (schaduw, eigen account, pilot, iedereen)

- Nieuwe tabel met per werkruimte en soort vraag: trede, reeks, laatste wijziging en reden. Startstand uit de eigen geschiedenis, zodat bestaande auto-send-winkels er niet op achteruitgaan.
- Omhoog: na 30 ongewijzigde goedkeuringen op rij en nul gefaalde checks een voorstel aan de winkelier. Omlaag: automatisch bij een correctie die `learn-from-edits` als `fact` of `policy` classificeert, of bij een klacht.
- Plafonds: bestelstatus, verzending, productvraag en compliment tot trede 3; retour, ontbrekend, beschadigd en garantie tot trede 2; klacht, annulering, betaling en fallback blijven trede 1.
- Schaduw: bij elke beslissing vastleggen wat de ladder zou doen naast wat er nu gebeurt. Daarna een schakelaar per werkruimte, eerst ons eigen testaccount.
- Inbox toont de voortgang ("27 van 30, daarna verstuurt Seffy dit zelf").
- Klaar als: ons eigen testaccount twee weken op de ladder draait zonder fout, daarna de pilotwinkels.

### Fase 4: vervanging

- Ladder standaard voor iedereen; `autosend_threshold` alleen nog vangnet of verwijderd; schakelaars en schaduwkolommen opgeruimd; docs bijgewerkt.
- Klaar als: er geen codepad meer is dat alleen op de zekerheid van het model automatisch verstuurt, en de testset groen is.

### Later

Meten of goedgekeurde lessen de mate van aanpassing verlagen; Otis laten leren van voorspelling tegenover werkelijkheid; echte gevallen in de testset zodra de verwerkersovereenkomst dat toelaat.

## Werkwijze

- Eén branch per stap; Codex reviewt alleen-lezen bij pipeline, auto-send, geld en rechten.
- Een productiefout wordt eerst een testcase, dan pas een fix.
- Klantdata komt nooit in git. De testset in `evals/` is verzonnen.
- Live testset draaien kost een paar cent per run (OpenAI); hij zit daarom niet in `npm test`.

## Open beslissingen (Navaron en Ezra)

- Echte klantgevallen in de testset: verwerkersovereenkomst aanpassen, toestemming per winkel, of alleen ons eigen testaccount?
- Drempel van 30 en de plafonds per soort vraag: akkoord als startwaarde?
