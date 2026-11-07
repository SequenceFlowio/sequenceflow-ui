# SequenceFlow — financieel overzicht met actuele prijzen

Bijgewerkt 7 november 2026. Voorlopig rekenmodel, geen vastgestelde jaarrekening. Het oorspronkelijke financiële document op Claude is niet uitgelezen; dit overzicht vervangt dat document niet en reconstrueert geen ontbrekende kosten.

## 1. Prijzen en omzet

| Pakket | Per maand, exclusief btw | Inbegrepen afhandelingen | Conceptlimiet |
|---|---:|---:|---:|
| Starter | €47 | 100 | 500 |
| Growth | €147 | 400 | 2.000 |
| Scale | €297 | 1.000 | 6.000 |

Extra afhandelingen: €0,47 gecontroleerd / €0,97 zelfstandig. Beide soorten delen één inbegrepen bundel. In de rekenhulp wordt die bundel naar verhouding verdeeld; de factuur volgt de werkelijke afhandelvolgorde.

Shopify rekent dezelfde getallen in USD, niet EUR. Euro- en dollaromzet moeten afzonderlijk worden geboekt en omgerekend; onderstaande eurovoorbeelden veronderstellen uitsluitend directe EUR-klanten. Geen omzet uit extra afhandelingen of eenmalige inrichting meegerekend.

Voorbeeldmix, GEEN gemeten klantverdeling: 60% Starter, 30% Growth, 10% Scale. Gemiddelde abonnementsomzet = 0,60 × 47 + 0,30 × 147 + 0,10 × 297 = **€102 per klant per maand**. Met de oude prijzen was dit €104. Een verlaging met €2 per klant per maand; 1.000 klanten betekent €2.000 minder maandelijkse omzet bij gelijk volume. Extra gesprekstarieven daalden eveneens met €0,02; per 10.000 extra afhandelingen betekent dit €200 minder omzet bij ongewijzigde verdeling en kosten.

| Klanten | Starter / Growth / Scale | Maandelijkse abonnementsomzet |
|---:|---|---:|
| 100 | 60 / 30 / 10 | €10.200 |
| 500 | 300 / 150 / 50 | €51.000 |
| 1.000 | 600 / 300 / 100 | €102.000 |
| 3.000 | 1.800 / 900 / 300 | €306.000 |
| 10.000 | 6.000 / 3.000 / 1.000 | €1.020.000 |

## 2. Kosten: wat bekend is en wat nog geen feit is

De repo-note van 6 november noemt 76–86% marge bij vol gebruik en AI circa €0,003 per gesprek. De onderliggende volledige kostenberekening ontbreekt hier. Dit is dus historische onderbouwing, geen geverifieerde actuele nettowinstmarge. Een vaste 70% bedrijfskosten is NIET onderbouwd en vervalt.

`lib/internal/costs.ts` bevat:
- AI-kosten op tokenverbruik per model, met een vaste USD/EUR-aanname van 0,92; geen actuele wisselkoersgarantie.
- Stripe-kostenmodel: 2,7% van de factuur plus €0,25. Dit is de bestaande modelaanname voor kaart + Billing + Tax; werkelijk contract, kaartsoort, btw-grondslag en andere betaalmethoden kunnen afwijken.
- Geschatte vaste kosten: Vercel €19, Supabase €24, Resend €0, domein/e-mail €10 = €53 per maand. NIET geschikt om gelijk te houden bij 10.000 klanten zonder verbruiksbegroting.

Nog met echte facturen/budgetten te onderbouwen: alle AI-calls incl. chat/vertaling/zoektocht/hergeneraties; infrastructureel meerverbruik; mail; Shopify-fees en valuta; refunds; advertenties; affiliatevergoedingen; administratie; verzekeringen; personeel; management/loon. Een marge op alleen AI is geen totale bedrijfswinstmarge.

Zuivere gevoeligheid bij bovenstaande klantmix, als dezelfde absolute kosten per klant behouden blijven: oude 76–86% marge op €104 wordt circa **75,53–85,73%** op €102. Een oude marge van 90% zou dan circa **89,80%** worden. Dit rekent alleen de prijsdaling door; het bewijst geen van deze marges.

## 3. Belastingmodel — VOORLOPIG BV-scenario, rechtsvorm nog niet bevestigd

Aan de gebruiker is gevraagd of sprake is van BV of VOF en wat de winstverdeling is. Onderstaande tabel geldt uitsluitend voor een Nederlandse BV met twee in Nederland wonende, niet-AOW-gerechtigde actieve aandeelhouders, ieder 50%, zonder werknemersverzekeringen. Geen andere inkomsten, fiscale partnerverdeling, box 3, aftrekposten of pensioen. Geen holdingkosten meegenomen. Alle beschikbare winst wordt uitgekeerd; geen groeireserve. Het zijn jaarbedragen gedeeld door 12, NIET een gegarandeerde maandelijkse uitkering.

Om een voorbeeld te geven is **90% operationele marge vóór beide DGA-lonen** aangenomen. Dat is een gevoeligheidsscenario op verzoek, geen vastgestelde marge. Beide DGA-lonen: €58.000 bruto per jaar. Het gebruikelijk loon kan hoger zijn op grond van vergelijkbaar loon of werknemersloon; €58.000 is niet automatisch voor iedereen het juiste bedrag.

Rekenvolgorde:
1. Jaaromzet × operationele marge = resultaat vóór DGA-lonen.
2. Twee bruto DGA-lonen aftrekken; restant vormt hier de belastbare BV-winst.
3. Vpb: 19% over de eerste €200.000 jaarwinst; 25,8% over het meerdere.
4. Resterende winst ieder voor de helft als dividend.
5. Per persoon box 2: 24,5% over de eerste €68.843 dividend per jaar; 31% over het meerdere. Geen verdeling met fiscale partner.
6. Netto loon toevoegen. Box 1 voor niet-AOW: 35,75% tot €38.883; 37,56% tot €78.426; daarboven 49,5%. Arbeidskorting bij €58.000: €5.685 − 6,510% × (€58.000 − €45.592). Algemene heffingskorting voorzichtig op nul; deze is afhankelijk van verzamelinkomen. Eigen Zvw-bijdrage 4,85% over loon (bij deze niet-verzekerde DGA-aanname). Dit geeft circa €3.249 netto loon per maand, zonder nominale zorgpremie.

Dividendbelasting is een voorheffing die met box 2 wordt verrekend: geen extra 15% bovenop het box-2-tarief rekenen. Btw is geen opbrengst; uitgaven en omzet in dit model zijn exclusief verrekenbare btw. Geen fiscale verliezen, box-2-verliezen of andere afwijkingen aangenomen. Uitkering moet juridisch en qua liquiditeit toegestaan zijn.

| Klanten | Omzet/maand | Resultaat vóór DGA-lonen bij aangenomen 90% | Indicatie privé per persoon na gemodelleerde belastingen/maand |
|---:|---:|---:|---:|
| 100 | €10.200 | €9.180 | Onvoldoende om twee lonen van €58.000/jaar te dekken; geen passend nettoresultaat onder deze aannames |
| 500 | €51.000 | €45.900 | circa €13.288 |
| 1.000 | €102.000 | €91.800 | circa €25.038 |
| 3.000 | €306.000 | €275.400 | circa €72.038 |
| 10.000 | €1.020.000 | €918.000 | circa €236.537 |

Aansluiting op eerder gesprek: bij **€120.000 omzet per maand**, aangenomen **90% marge vóór DGA-loon**, 50/50 en bovenstaande fiscale aannames: circa **€29.185 privé per persoon per maand**. Dit is inclusief netto DGA-loon en netto dividend, vóór persoonlijke uitgaven. Niet €54.000 netto; €54.000 was vóór DGA-loon/belasting.

Gevoeligheid bij €120.000 maandomzet: bij 80% marge vóór DGA-loon circa €26.113 privé per persoon per maand; bij 90% circa €29.185. Iedere extra zakelijke uitgave verlaagt het uitkeerbare resultaat.

**Niet gebruiken als VOF-berekening.** Bij VOF geldt inkomstenbelasting over het winstaandeel, met eigen regels voor ondernemersaftrek, mkb-winstvrijstelling en Zvw; geen Vpb/dividendroute.

## 4. Officiële bronnen — belastingjaar 2026

- Vpb: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/vennootschapsbelasting/tarieven_vennootschapsbelasting
- Box 2: https://www.belastingdienst.nl/wps/wcm/connect/fisin/fisin2026/belastingberekening
- Gebruikelijk loon: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/vermogen_en_aanmerkelijk_belang/aanmerkelijk_belang/loon_en_aanmerkelijk_belang/
- Box 1: https://www.belastingdienst.nl/wps/wcm/connect/nl/werk-en-inkomen/content/hoeveel-inkomstenbelasting-betalen
- Arbeidskorting: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/heffingskortingen/arbeidskorting/tabel-arbeidskorting-2026
- Zvw: https://www.belastingdienst.nl/wps/wcm/connect/fisin/fisin2026/inkomensafhankelijke_bijdrage_zorgverzekeringswet
- Dividendvoorheffing verrekenen: https://ondernemersplein.overheid.nl/wetten-en-regels/dividend-dividendbelasting-dividenduitkering/

2026 is het vaste rekenjaar, geen voorspelling van belastingtarieven over drie of vijf jaar.
