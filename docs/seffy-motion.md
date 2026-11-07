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

De hero houdt één observing-loop actief: een posewisseling herstart de blik en knippertimers niet meer. Expressies volgen een tijdsafhankelijke easing (110 ms tijdconstante), ook terug naar neutraal. Normale ogen en tevreden oogbogen mengen geleidelijk; ongelijke oogmaten springen niet meer rechtstreeks naar hun eindwaarde. Reduced motion herstelt de neutrale ogen. TypeScript, gerichte lint en productiebuild geslaagd. Browserhercontrole in deze ronde niet beschikbaar door een browserverbindingfout; visuele beoordeling op localhost:3216/support-one blijft nodig.

## Speels krimpen met losse headset

Extra hero-gebaar van 1,8 seconde: lijf en ogen krimpen twee keer naar 72% en 65%, terwijl de headset op hoogte blijft en licht uitgedempt bungelt. Daarna groeit het lijf met een kleine overshoot terug. Eigen SVG-groepen scheiden dit van de bolrotatie; minder beweging schakelt het uit. Gerichte lint, TypeScript en productiebuild geslaagd.

## Oogwissel en headset-einde

Tijdens het dubbele krimpen wordt eerst links groter/rechts kleiner, daarna omgekeerd. Eigen oog-wrappers behouden de doorlopende blik en knipoog; de schaal wisselt met dezelfde easing als het lijf. Headsetbeugel en cups hebben nu positieve diepte zodat ze vlak voor de ruststand niet achter het witte hoofd verdwijnen. Een regressietest controleert de laatste draaihoeken.

## Rondkijken en muis

Hero volgt de muis binnen 360 px. Buiten die straal kijkt hij zelfstandig afwisselend links, midden en rechts, met 1,4–2,6 seconden fixatie. De oogopening en -breedte groeien subtiel mee met de blikrichting. Pointerleave en venster-blur geven de blik terug aan de autonome animatie. Kleine app-avatars behouden hun bestaande gedrag. TypeScript en gerichte lint geslaagd.

## Aangesloten op Ezra’s afgeronde site

Gerebased op origin/main 7343b0e. SupportOneLanding behoudt Ezra’s nieuwe AI-team-titel, hero-video en demo-indeling. HeroSeffy gebruikt nu SeffyMotion in de actieve componentmap; de gearchiveerde Milo-component is ongewijzigd tegenover main. Productiebuild geslaagd. Nog geen main-push.
