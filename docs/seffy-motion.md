# Seffy — beweging, 7 november 2026

Branch: `codex/seffy-motion`. Geen main-integratie zonder Navaron/Ezra.

Referentie: https://x.ai/bot, hero ‘Meet Grok Bot’, live bekeken. De referentie wisselt blikrichting en kanteling af; de ogen vervormen mee terwijl het hoofd herkenbaar blijft. Navaron wees daarnaast op de hartachtige oogvormen, ongelijke ogen en kleiner worden. Geen uitputtende inventaris van alle mogelijke random animaties: de geobserveerde poses zijn steekproeven.

## Vertaling

- Bolrotatie: silhouet houdt volume; ogen schuiven over het oppervlak en verdwijnen achterlangs. Headset en microfoon wisselen tussen voor- en achterlaag. Geen CSS rotateY op het hele plaatje.
- Nieuwsgierig: één oog groter, ander smaller, korte kanteling en iets kleiner lijf.
- Luisteren: korte rustige kanteling richting gesprek, iets samengeknepen oog.
- Tevreden: twee kleine opwaartse oogbogen, geen gekopieerde hartjes.
- Knipoog: één oog sluit, klein limoen sterretje.
- Hop en rondje: overgenomen uit Milo, hoofd en headset blijven één geheel.
- Rust: enkele seconden tussen gebaren, natuurlijke blik en knipperen blijven aanwezig. Minder beweging schakelt animaties uit; verborgen tabbladen pauzeren.

Alle extra expressies staan op de hero-wrapper. Gewone app-avatars krijgen niet automatisch deze hele reeks. Geen antennes toegevoegd. Geometrische tests bewaken het terugkeren naar de rustpositie en de voor/achter-wisseling van de oorschelpen.

## Vloeiende overgangen

De hero houdt één observing-loop actief: een posewisseling herstart de blik en knippertimers niet meer. Expressies volgen een tijdsafhankelijke easing (110 ms tijdconstante), ook terug naar neutraal. Normale ogen en tevreden oogbogen mengen geleidelijk; ongelijke oogmaten springen niet meer rechtstreeks naar hun eindwaarde. Reduced motion herstelt de neutrale ogen. TypeScript, gerichte lint en productiebuild geslaagd. Browserhercontrole in deze ronde niet beschikbaar door een browserverbindingfout; visuele beoordeling op localhost:3216/s1 blijft nodig.

## Speels krimpen met losse headset

Extra hero-gebaar van 1,8 seconde: lijf en ogen krimpen twee keer naar 72% en 65%, terwijl de headset op hoogte blijft en licht uitgedempt bungelt. Daarna groeit het lijf met een kleine overshoot terug. Eigen SVG-groepen scheiden dit van de bolrotatie; minder beweging schakelt het uit. Gerichte lint, TypeScript en productiebuild geslaagd.

## Oogwissel en headset-einde

Tijdens het dubbele krimpen wordt eerst links groter/rechts kleiner, daarna omgekeerd. Eigen oog-wrappers behouden de doorlopende blik en knipoog; de schaal wisselt met dezelfde easing als het lijf. Headsetbeugel en cups hebben nu positieve diepte zodat ze vlak voor de ruststand niet achter het witte hoofd verdwijnen. Een regressietest controleert de laatste draaihoeken.
