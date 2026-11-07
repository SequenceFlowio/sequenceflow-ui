# Websitecontrole — 7 november 2026

Branch: `codex/pricing-page-polish`. Niet naar main op verzoek van Navaron.

## Gecontroleerd

- Homepage: Otis-deeplink, blauwe sectielabel, kaarten openen, volgende functie, Escape en terugkerende focus. Seffy/Otis wisselen nu ook met pijltjestoetsen, Home en End; tab/panel zijn toegankelijk gekoppeld.
- Prijzen: desktop en 390 px eerder gecontroleerd; calculator nu ook met toetsenbord getest. Bedragen en pakketlimieten niet aangepast.
- Mobiel 320 px: header toont Inloggen en Kennismaken; documentbreedte en scrollbreedte beide 320 px. Geen kapotte geladen afbeeldingen of ontbrekende lokale ankers op de homepage. Videocover bleek te vol: onder 480 px nu eenvoudiger, zonder afgekapte tekst.
- Contact: uitklappen datumkiezer levert actuele werkdagen vanaf 9 november. Incompleet formulier geeft de melding om dag en tijd te kiezen. Geen aanvraag verstuurd.
- Affiliate: mobiele navigatie werkt; voorbeeldstand gebruikt fictieve gegevens. Nu expliciet als voorbeeld gelabeld zolang de live-stand uitstaat. Geen registratie verstuurd.
- English-link is op mobiel via het menu bereikbaar gemaakt.
- HTTP 200: /support-one, /pricing, /contact, /affiliate, /blog, /en, /en/pricing, /privacyverklaring, /algemene-voorwaarden, /robots.txt, /sitemap.xml.
- Video afspelen, pauzeren en fullscreen openen/sluiten eerder deze sessie in desktopbrowser getest. iPhone/Safari-fallback geïmplementeerd maar niet op een echt iPhone-apparaat getest.

## Technisch

421 tests geslaagd. Volledige lint: 0 fouten, 61 waarschuwingen; gerichte lint van de aangepaste componenten schoon. Productiebuild met NEXT_PUBLIC_PRICING_V2=on geslaagd.

Lokale preview draait met de bestaande nieuwe prijsweergave aan. Geen productieconfiguratie, prijzen, rechten of database aangepast. Geen volledige betaalde checkout of echte e-mail-/formulieraflevering uitgevoerd.
