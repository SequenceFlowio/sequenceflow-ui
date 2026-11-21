# Content Calendar (sequenceflow.io/contentcalender)

Interne tool van SequenceFlow om Instagram- en Facebook-posts met tips voor drukke ondernemers te maken, goed te keuren (swipe) en in te plannen. Los van Support One: eigen toegangscode, eigen tabellen, geen tenants.

- Code: `app/contentcalender`, `app/api/contentcalender`, `lib/contentCalendar`
- Kennisbank (merk, doelgroep, pijlers, formats, actuele feiten, stem, beeldtaal): `lib/contentCalendar/brand.ts`
- Database: migratie `058_content_calendar.sql` (`content_posts`, `content_queue`, bucket `content-calendar`)
- Cron: `/api/contentcalender/cron` elke 5 minuten (beelden ophalen, wachtrij, publiceren, cijfers meten)

## Pijlers, formats en actuele feiten

Elke post heeft een **pijler** (onderwerp, bijv. Verzending & retouren) en een **format** (vorm, bijv. Mythe of feit, Rekensom, Checklist). De planner verdeelt beide op gewicht en zet nooit twee keer hetzelfde achter elkaar. Het formatlabel staat op de cover (bij gewone tips de pijler).

De formats `regels` en `platform` gebruiken alleen feiten uit `NEWS` in `brand.ts`: de tekst-AI heeft geen internet en mag geen wetten, deadlines of platformwijzigingen verzinnen. Nieuwe regel of update? Voeg hem daar toe, met `from`/`until` als hij maar een tijdje relevant is. `COMPETITOR_GUARD` houdt concurrenten van Support One en Content One (Shopify Inbox, Sidekick, Gorgias …) uit de posts.

## Prestaties en viral checker

De cron meet elke gepubliceerde post na 24 uur, 3 dagen en 7 dagen bij Meta (`lib/contentCalendar/insights.ts`) en bewaart de cijfers op de post (`data.metrics`). Een post krijgt een score ten opzichte van de mediaan van het eigen account op hetzelfde meetmoment (1 = gemiddeld; saves en shares wegen zwaarder dan likes, zie `performance.ts`). Vanaf 2× heet hij viraal: dan verschijnt er een melding in het tabblad Prestaties.

Self-healing: zodra een format of pijler 3 gescoorde posts heeft, krijgt hij een gewicht tussen 0,6× en 1,8× in de planner, en de tekst-AI krijgt de toppers en flops mee als les.

Bereik, saves en shares vragen het recht `instagram_manage_insights` op `META_ACCESS_TOKEN`. Zonder dat recht komen alleen likes en reacties binnen.

## Geen herhaling

- Elk nieuw concept wordt vergeleken met alle koppen in de kalender (`isTooSimilar` in `planning.ts`); lijkt het te veel, dan blijft het slot in de wachtrij voor een nieuwe poging.
- Werkt de tekst-AI niet (bijv. kie.ai-credits op), dan pauzeert de wachtrij 15 minuten met een melding. Reservetips worden alleen gebruikt als er geen tekst-AI is gekoppeld, en elke reservetip maar één keer.
- Nieuwsfeiten (`NEWS`) worden bijgehouden via `factId`; een feit dat binnen 90 dagen al in een post zat, wordt niet opnieuw aangeboden.
- Knop **Nieuw onderwerp** in een post (of `POST /api/contentcalender/posts/new-topic` met `ids`): vers onderwerp, foto blijft.

## Eigen producten

`OWN_TURF` in `brand.ts`: posts geven nooit een doe-het-zelf-alternatief voor wat Support One (klantmail beantwoorden) of Content One (social content) doet.

## Providers

| Wat | Provider | Env |
|---|---|---|
| Foto's | GenAI Pro, Nano Banana Pro (1 credit = 4 varianten); **ontkoppeld sinds 16 nov 2026**, weer aan met `CONTENT_GENAI_ENABLED=true` | `GENAIPRO_API_TOKEN` |
| Backup-foto's | kie.ai, Nano Banana 2.1 | `KIE_API_KEY` |
| Tekst | kie.ai, Gemini 3.8 Flash (zonder sleutel: ingebouwde tipbank) | `KIE_API_KEY`, optioneel `KIE_TEXT_MODEL` |

## Setup

1. Voer `supabase/migrations/058_content_calendar.sql` uit in de Supabase SQL-editor.
2. Zet in Vercel: `CONTENT_ACCESS_CODE`, `CONTENT_SESSION_SECRET` (lange willekeurige string), `GENAIPRO_API_TOKEN`, `KIE_API_KEY`.
3. Publiceren (optioneel, pas als je het wilt): `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_PAGE_ID` en daarna `CONTENT_AUTOPUBLISH=true`. Goedgekeurde posts gaan dan op hun datum en tijd (Nederlandse tijd) live als carrousel op Instagram en als post met foto's op de Facebook-pagina.

## Meta-koppeling

Nieuw: eigen SequenceFlow-app met "Inloggen met Facebook" (zie `docs/meta-app-review.md`). Zolang die niet gekoppeld is, gebruikt de app de tokens hieronder.


Een eigen Meta-app is nodig, maar App Review niet: in ontwikkelmodus mag de app posten op accounts waarvan je zelf beheerder bent.

1. Instagram moet een zakelijk account of creator-account zijn, gekoppeld aan de Facebook-pagina van SequenceFlow.
2. Maak een app op developers.facebook.com en genereer in de Graph API Explorer een token met `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` en `pages_manage_posts`.
3. Wissel dat in voor een langlevend paginatoken. Gebruik dat als `META_ACCESS_TOKEN`, en zet de pagina-ID en de Instagram-business-ID in `META_PAGE_ID` en `META_IG_USER_ID`.

Instagram haalt de slides zelf op via een getekende render-URL (`/api/contentcalender/render/...?format=jpg&t=...`). Dat werkt alleen op het publieke domein.

## Nederlands en Engels (vanaf 19 nov 2026)

De kalender heeft twee talen, met de NL/EN-knop linksboven. Elke taal is een eigen kalender:

- **Nederlands**: het bestaande account (@sequenceflownl). Tijden in Amsterdamse tijd. De generator ("Genereer posts") schrijft alleen Nederlands.
- **Engels**: voor een Amerikaans publiek (standaard @sequenceflowio, aan te passen met `CONTENT_EN_HANDLE`). Tijden in New Yorkse tijd (ET); de cron publiceert elke taal op zijn eigen klok.

**Engelse content**: "Vertaal carrousels" maakt van Nederlandse carrousels in een periode een Engelse versie (`lib/contentCalendar/translate.ts`, OpenAI, model `CONTENT_TRANSLATE_MODEL`, standaard gpt-4.1). Geen letterlijke vertaling: dollars, Amerikaanse voorbeelden. Posts die alleen in Nederland of de EU kloppen, worden overgeslagen (`englishSkip` op de Nederlandse post). Reels en stories gaan nooit mee; die worden voor Engels apart gemaakt. De Engelse post krijgt id `<nl-id>-en`, dezelfde datum en tijd (maar dan ET) en hetzelfde beeld; staat er Nederlandse tekst in het beeld (interfacebeelden), dan staat `needsEnglishImage` aan.

**Koppelingen per taal**:
- Meta: één Facebook-login; per taal kies je een pagina met het Instagram-account eraan (`selectedPageId` en `selectedPageIdEn` in content_queue `meta-connection`). Maak de Engelse pagina in hetzelfde Business-portfolio en klik op "Opnieuw koppelen" zodat hij in de lijst staat.
- TikTok: per taal een eigen login (`tiktok-connection` en `tiktok-connection-en`). Zolang de TikTok-app niet is goedgekeurd, moet het Engelse TikTok-account als target user in de sandbox staan.

Prestaties en scores zijn per taal: een Engelse post wordt vergeleken met andere Engelse posts.

## Reel-generator (vanaf 20 nov 2026)

Elke dag 2 reels per taal (NL 12:30 en 20:00 Amsterdam, EN 12:00 en 19:00 New York), plus 1 carrousel per week per taal. Drie typen, volgens hook → vraag → antwoord → beloning:
- **tips**: gemaakt van een bestaande carrousel (die carrousel gaat daarna niet meer live: status afgekeurd met "Omgezet naar tips-reel").
- **aware**: pijnpunt → Seffy (klantmail) of Otis (voorraad) → proefperiode.
- **unaware**: inhoudelijk, zonder product; soms een cameo van Otis of Seffy.

Concepten: `lib/contentCalendar/reels.ts` (kie.ai). Elk concept wordt gecontroleerd (`reelPlan.ts`): uniek onderwerp, geen doe-het-zelf-alternatief voor Support One (sjablonen, macro's, chatbots, ChatGPT), geen concurrenten, geen lange streepjes, voice-over niet te lang.

Video: de reel-worker op de Hetzner-server (`/opt/sequenceflow-reels`, bron in `Sequence Flow/content-reels`) haalt concepten op via `GET /api/contentcalender/reels/queue`, claimt ze, maakt de stem (Lumenon, ElevenLabs v4) en de video (Remotion), uploadt via een signed upload-URL en meldt `done`. Pas dan kan de reel gepost worden (`hasMedia`); hij wordt op zijn moment automatisch goedgekeurd. Video's van gegenereerde reels worden 2 dagen na publicatie op Instagram uit de opslag gehaald.

### Reels eerst (vanaf 20 nov 2026)
- Per taal 2 gegenereerde reels per dag en 1 carrousel per week (de sterkste van die week). Carrousels deden gemiddeld bereik 4, reels 31.
- De andere carrousels staan op `parked` (met reden): ze worden niet als carrousel gepost, maar blijven bron voor tips-reels. Zodra een tips-reel ervan gemaakt is, gaat de bron op `rejected` ("Omgezet naar tips-reel"). In de post zit een knop "Toch als carrousel posten".
- Tips-reels hebben precies 3 tips (~30 s).

### Hooks, AI-woorden en captions (vanaf 21 nov 2026)
- `lib/contentCalendar/copy.ts` + `copyData.json`: 17 hook-formules (uit instagram-agent-skill, MIT, ingekort tot wat bij een merk past). Elke reel krijgt een formule die niet bij de laatste 8 zat; formules die goed scoren komen vaker terug (`reel.hook` bewaart de id).
- AI-woordenlijst: Engels (154 woorden/zinnen + zinsbouw) en een eigen Nederlandse lijst. Een concept met zo'n woord wordt afgekeurd en kie krijgt de reden terug. Onzichtbare tekens worden weggehaald.
- Captions: max 300 tekens, eerste regel max 125 (de hook), één oproep, geen hashtags. Hashtags worden nergens meer gepost (Instagram en TikTok).
