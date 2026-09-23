# Support One — huisstijl en navigatie

## Doel

De ingelogde app laten aansluiten op de zwarte, limoengroene landingspagina en de navigatie duidelijker maken voor een eerste gebruiker. De bestaande mascotte blijft het gezicht van Support One.

## Wijzigingen

- De onderste CTA van de landingspagina is weer donker, met twee duidelijke acties en een grote, subtiele omtrek van de bestaande mascotte. Zo krijgt de pagina de gewenste afsluiting zonder de eerdere zware afbeelding en lege footercompositie.
- De appnavigatie is gegroepeerd naar **Werken**, **Verbeteren** en **Beheren**. Het afgekapte logo is vervangen door een compacte Support One-lockup met de mascotte. De onbeschikbare videotutorial is uit het menu gehaald.
- De zichtbare naam **Lumen** is **Vraag Support** geworden. Het hersenicoon is vervangen door de mascotte in de assistentweergave en een gesprekspictogram in de navigatie. De onderliggende route en API blijven voorlopig `/lumen`, zodat bestaande links blijven werken.
- **Home** heet nu **Overzicht**, **Agent Profiel** heet **Gedrag & stijl**, **Integraties** heet **Koppelingen**, en de read-only commerce-pagina heet **bol.com-data**. De tekst bij Gedrag & stijl zegt expliciet dat correcties leervoorstellen kunnen opleveren die eerst door de gebruiker worden beoordeeld.
- De mascotte staat ook in de lege beoordelingsinbox. Informatieve vlakken en links rond bol.com zijn omgezet van blauw/wit naar thema-afhankelijke limoentinten. Waarschuwingen en fouten behouden herkenbare statuskleuren.
- In Instellingen staat nu **Weergave**: donker met limoen is standaard, licht is een optionele keuze die alleen in de huidige browser wordt bewaard.
- De zichtbare foutmeldingen, laadtekst en privacyuitleg gebruiken eveneens **Vraag Support** of **Ask Support**. Interne symbolen en de bestaande API-route blijven om compatibiliteitsredenen vooralsnog `lumen` heten.
- De mobiele navigatie gebruikt compactere rijen zodat ook Instellingen eerder in beeld komt. De actieve instellingentab wordt in de horizontale tablijst automatisch in beeld gebracht.
- De bronnenlijst van Vraag Support gebruikt dezelfde benamingen voor bol.com-data en Gedrag & stijl, met correcte enkelvouds- en meervoudstekst voor bestellingen en kennisbronnen.
- In Gedrag & stijl gebruikt de zichtbare profieltekst **antwoordprofiel** in plaats van de oude interne productterm **Agent DNA**.
- Koppelingen, bol.com-data en Analytics gebruiken in de hoofdteksten dezelfde termen als de navigatie; de koppelingenpagina legt vooraan uit dat de mailbox de kern is en bestelgegevens optioneel zijn.

## Verificatie

- De onderste CTA en de grote mascotte zijn lokaal visueel beoordeeld.
- 149 tests geslaagd; de gerichte tests voor de nieuwe naam zijn na de tekstcorrectie opnieuw geslaagd.
- Gerichte ESLint en de volledige Next.js-productiebuild zijn geslaagd.

## Grenzen voor livegang

- Deze fase verandert presentatie en navigatie, niet de mail- of commerce-koppelingen. De namen Shopify en WooCommerce worden niet gebruikt alsof orderdata voor elke gebruiker beschikbaar is.
- De lokaal beschikbare OpenAI-sleutel gaf eerder `credit_balance_exhausted` bij embeddings en antwoordgeneratie. De actuele productiesleutel en een volledige mail → concept → goedkeuren → verzenden-proef moeten nog operationeel worden bevestigd.
- De audit noemt daarnaast verdere betrouwbaarheidsverbeteringen voor verzenden en foutdoorvoer. Die zijn geen onderdeel van deze stijlfase.
