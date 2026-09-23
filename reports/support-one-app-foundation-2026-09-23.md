# Support One — appfase 1: bronbeschikbaarheid

## Vastgestelde oorzaak

Een directe API-controle met de **lokaal ingestelde sleutel** en uitsluitend synthetische tekst gaf voor zowel `text-embedding-3-small` als de Lumen-chataanroep HTTP 429 met `credit_balance_exhausted`. De lokale OpenAI-organisatie heeft dus geen API-tegoed meer. Dit past bij de eerder waargenomen live fouten, maar de productieomgeving kan een andere sleutel gebruiken; haar exacte foutoorzaak is hiermee niet bewezen. De ingestelde Lumen-model-ID bestaat volgens de Models API, maar de chatroute zelf kan pas na herstel van het tegoed worden gevalideerd. Deze codewijziging kan geen nieuw tegoed toevoegen.

## Aangepast gedrag

- De kennistest onderscheidt een lege zoekuitkomst van een zoekstoring. Bij opgeraakt API-tegoed, een ongeldige sleutel of een tijdelijke limiet staat er een concrete, vertaalde foutmelding.
- `retrieveKnowledgeContext` meldt expliciet of de zoekvoorziening beschikbaar was. Bij een storing kan een gegenereerd concept niet automatisch worden verstuurd: het gaat ter beoordeling naar een medewerker en mogelijke acties worden verwijderd.
- De kennisbank noemt verwerkte documenten geen bewijs meer van werkend kenniszoeken. Een voorbeeldvraag test de zoekfunctie afzonderlijk.
- Lumen meldt een AI-tegoed- of configuratieprobleem concreet. Als alleen kenniszoeken uitvalt maar de chat nog werkt, vermeldt het antwoord zichtbaar dat beleidskennis niet kon worden opgehaald.

## Nog nodig

1. Beheerder vergelijkt de OpenAI-configuratie van productie met lokaal en vult waar nodig het API-tegoed aan of wijst een werkende sleutel met voldoende tegoed toe.
2. Controleer daarna met een synthetische retourvraag dat de kennistest een relevante bron vindt, en test Lumen met een eenvoudige vraag. De eerdere 429 verhinderde verificatie van het Lumen-model zelf.
3. Controleer met een pilotmail dat een bronstoring tot menselijke beoordeling leidt en nooit tot automatisch versturen.

Er zijn voor deze diagnose geen klantmails verstuurd en geen klantinhoud naar de AI-API gestuurd.

## Controle

- 149 bestaande en nieuwe tests geslaagd.
- Gerichte ESLint-controle en app-typecheck geslaagd.
- Next.js-productiebuild geslaagd.
- De echte productieflows konden wegens ontbrekend API-tegoed niet opnieuw end-to-end worden uitgevoerd.
