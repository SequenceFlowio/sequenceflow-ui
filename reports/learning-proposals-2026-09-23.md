# Leervoorstellen in Support One

## Wat de app daadwerkelijk doet

Na verzending bewaart Support One de onaangepaste AI-tekst naast de definitieve menselijke versie. De vijfminuten-taak `learn-from-edits` vergelijkt die teksten, negeert kleine/niet-herbruikbare wijzigingen, maskeert bekende persoonsgegevens en kan een korte regel met voldoende zekerheid als voorstel opslaan. Een beheerder kan het voorstel aanpassen, goedkeuren of afwijzen. Alleen goedgekeurde afspraken in een actief Agent Profiel gaan mee naar nieuwe concepten. De toonkeuze in Instellingen is de algemene basis; het actieve profiel verfijnt die.

## Gevonden en aangepast

- Leervoorstellen stonden onder Agent Profiel zonder duidelijke verwijzing vanuit Instellingen → Antwoordstijl. Daar staat nu dezelfde illustratieve correctie als op de landingspagina, met uitleg en een directe link.
- De link scrollt naar de voorstelkaart zodra de profieldata is geladen; bij een leeg profiel opent hij de bijbehorende uitleg.
- Een eerste correctie kon wel een voorgestelde regel opleveren, maar zonder eerder ingelezen mailboxhistorie bestond soms nog geen profiel. Dan verborg de UI het voorstel. De leertaak maakt nu bij een herbruikbaar voorstel een conceptprofiel aan zonder een bestaand actief profiel te overschrijven. De UI toont bestaande leerdata ook zonder profiel; activeren kan na goedkeuring een profiel aanmaken.
- Bij echte leervoorstellen toont Agent Profiel nu de geanonimiseerde verwijderde/toegevoegde tekst en, als beschikbaar, het bronantwoord. Voorgestelde regels uit mailboxhistorie zijn afzonderlijk gelabeld.
- De voorstelrij was als component binnen de pagina gedeclareerd. Elke toetsaanslag kon daardoor het tekstveld opnieuw monteren en de focus verliezen. De rij wordt nu direct als stabiel element gerenderd, zodat bewerken bruikbaar blijft.
- De interface zegt nu expliciet dat goedkeuring alleen nog niet genoeg is: het profiel moet actief zijn voordat de afspraak nieuwe antwoorden beïnvloedt.

## Praktijkcontrole die nog nodig is

Een read-only telling in de gekoppelde database op 23 september 2026 toont 17 leersignalen, 7 open voorstellen uit correcties en 0 mislukte leersignalen. Er is één actief profiel; geen van de 7 open voorstellen mist een profiel. Het meest recente leersignaal is van 9 september 2026. De leertaak heeft dus daadwerkelijk voorstellen gemaakt, maar deze telling zegt niets over de kwaliteit van de regel in een nieuw antwoord.

Er is in deze ronde geen echt aangepast antwoord in een live tenant verzonden. Voor een pilot: corrigeer een concept, verstuur het, laat de geplande leertaak draaien, controleer het voorstel in Agent Profiel, keur het goed, activeer het profiel en toets een nieuw concept. Een enkele correctie hoeft bewust geen voorstel op te leveren: het model kan de wijziging als niet-herbruikbaar beoordelen of onder de zekerheidsdrempel blijven.
