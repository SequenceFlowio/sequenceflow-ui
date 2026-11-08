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

## Eigen producten

`OWN_TURF` in `brand.ts`: posts geven nooit een doe-het-zelf-alternatief voor wat Support One (klantmail beantwoorden) of Content One (social content) doet.

## Providers

| Wat | Provider | Env |
|---|---|---|
| Foto's | GenAI Pro, Nano Banana Pro (1 credit = 4 varianten); alleen als er actieve credits zijn | `GENAIPRO_API_TOKEN` |
| Backup-foto's | kie.ai, Nano Banana 2.1 | `KIE_API_KEY` |
| Tekst | kie.ai, Gemini 3.8 Flash (zonder sleutel: ingebouwde tipbank) | `KIE_API_KEY`, optioneel `KIE_TEXT_MODEL` |

## Setup

1. Voer `supabase/migrations/058_content_calendar.sql` uit in de Supabase SQL-editor.
2. Zet in Vercel: `CONTENT_ACCESS_CODE`, `CONTENT_SESSION_SECRET` (lange willekeurige string), `GENAIPRO_API_TOKEN`, `KIE_API_KEY`.
3. Publiceren (optioneel, pas als je het wilt): `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_PAGE_ID` en daarna `CONTENT_AUTOPUBLISH=true`. Goedgekeurde posts gaan dan op hun datum en tijd (Nederlandse tijd) live als carrousel op Instagram en als post met foto's op de Facebook-pagina.

## Meta-koppeling

Een eigen Meta-app is nodig, maar App Review niet: in ontwikkelmodus mag de app posten op accounts waarvan je zelf beheerder bent.

1. Instagram moet een zakelijk account of creator-account zijn, gekoppeld aan de Facebook-pagina van SequenceFlow.
2. Maak een app op developers.facebook.com en genereer in de Graph API Explorer een token met `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` en `pages_manage_posts`.
3. Wissel dat in voor een langlevend paginatoken. Gebruik dat als `META_ACCESS_TOKEN`, en zet de pagina-ID en de Instagram-business-ID in `META_PAGE_ID` en `META_IG_USER_ID`.

Instagram haalt de slides zelf op via een getekende render-URL (`/api/contentcalender/render/...?format=jpg&t=...`). Dat werkt alleen op het publieke domein.
