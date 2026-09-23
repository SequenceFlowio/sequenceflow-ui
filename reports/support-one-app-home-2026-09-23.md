# Support One — ingelogde startpagina en inboxstatus

## Bevinding

De ingelogde startpagina leek op een productdemo. Ze toonde verzonnen klantnamen, voorbeeldmails, een teller die vanzelf opliep en statistieken zonder relatie met de tenant. In de echte inbox konden tegelijk nul klantvragen en een ontbrekende mailverbinding staan. Dat ondermijnde het onderscheid tussen de marketingdemo en de operationele app.

## Wijziging

- De startpagina haalt nu tenantgebonden tickets en mailinstellingen op via de bestaande API's. De drie aantallen zijn echte totalen voor `te beoordelen`, `verzonden` en `geëscaleerd` in de huidige inbox. Er staan geen gefingeerde percentages of klantvragen meer.
- De eerste aanbevolen handeling volgt de daadwerkelijke inrichting: inkomende mail, uitgaande mailtest, antwoordstijl, kennisbron, en daarna inbox of kenniszoektest.
- Recente vragen linken naar hun echte inboxdetail. Bij een lege inbox wordt het verschil getoond tussen “nog geen mail ontvangen” en “nog geen inkomende mail verbonden”.
- De kennisstatus noemt het aantal verwerkte documenten, maar claimt geen werkende zoekfunctie zonder zoektest. Webshopgegevens staan apart als optionele koppeling.
- De inbox heeft bij ontbrekende inkomende mail een directe knop naar Integraties. Een optionele webshopkoppeling maakt de mailinbox niet meer onterecht “niet operationeel”. Een ooit ontvangen doorgestuurde mail wordt niet langer als bewijs van een huidige liveverbinding omschreven.

## Grenzen

- `isForwardingActive` in de bestaande setup-API is afgeleid van het feit dat ooit mail is ontvangen. Deze wijziging formuleert de status eerlijker, maar voegt geen continue forwarding-healthcheck toe.
- Het aantal verwerkte kennisdocumenten is geen test van vectorzoeken. Die test blijft een afzonderlijke handeling in de kennisbank.
- De API voor de ticketlijst geeft bij bepaalde onderliggende databasefouten momenteel een lege lijst terug. Deze wijziging gebruikt de bestaande API; een afzonderlijke fase kan foutdoorvoer aanscherpen.
- De lokaal ingestelde OpenAI-sleutel gaf `credit_balance_exhausted` voor zowel embeddings als antwoordgeneratie. Dat is in de vorige fase als zichtbare storing verwerkt. De actuele productiesleutel en productiegedrag moeten apart worden bevestigd.
