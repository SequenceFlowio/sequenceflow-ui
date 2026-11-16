# Uitlegvideo's (awareness-ads)

Losse Remotion-project, staat los van de Next.js-app (eigen `package.json`, uitgesloten in de root-tsconfig en eslint).

- `npm install` in deze map, daarna `npm run studio` om te bekijken of `npm run render:all` om alle MP4's in `out/` te zetten.
- 9:16, 1080×1920, 30 fps. Stijl en kleuren komen van de website (`src/theme.ts`), de mascotte van `SequenceMark`.
- Video's: SupportOne, PainPoints, Stock (Otis), ContentOne (Juno, early access). Engelse versies: SupportOneEN, PainPointsEN, StockEN (`npm run render:en`). 1:1-feedversies: ...Square-composities (`npm run render:square`, 1080×1080); teksten per taal staan bovenaan elk bestand in `TEXT`.
- Geluid: rustig muziekbed (96 bpm) plus pop/klik/whoosh/ding op de momenten in beeld. Alles zelf gesynthetiseerd met `npm run audio` (scripts/make-audio.py), dus geen rechten nodig. `render:all` zet het geluid daarna op -14 LUFS.
- Renderen gebeurt lokaal, er zijn geen API-kosten.
