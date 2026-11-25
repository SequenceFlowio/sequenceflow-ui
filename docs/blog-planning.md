# Blogplanning

Doel: minimaal 4 posts per week (ma t/m zo), voor vindbaarheid in Google en om Support One (Seffy, Otis, Analytics, pijnpunten) te laten zien.

## Hoe het werkt
- Elke post is een Markdown-bestand in `content/blog` met front matter (`title`, `description` ≤ 200 tekens, `tag`, `publishDate`, `readTime`, `cover`, `keyword`).
- `publishDate` in de toekomst = gepland. De post gaat op die dag om 07:00 (Amsterdam) live; blog, posts en sitemap verversen elk uur (`revalidate = 3600`), dus geen deploy nodig.
- Illustraties zijn inline SVG in `lib/marketing/blogFigures.ts`, in de huisstijl (zwart, limoen). `cover:` en `::figure[naam]` gebruiken dezelfde namen.
- Backoffice → tab **Blog**: wat live staat en wat gepland is, weekdoel per week, voorbeeld van elke (geplande) post met Google-snippet, en GA4-cijfers per post (weergaven, lezers, leestijd, sessies via Google, belangrijke gebeurtenissen).
- `tests/blog-schedule.test.ts` bewaakt: complete front matter, bestaande figuren, interne links alleen naar posts die eerder live gaan, en het weekdoel voor de geplande weken.

## Batches
| Batch | Posts | Periode | Branch |
| --- | --- | --- | --- |
| 1 | 20 | 17 nov – 20 dec 2026 (ma/wo/vr/zo, week 1: di/wo/vr/zo) | `feat/blog-planning` |
| 2 | 17 | de lege dagen van 26 nov – 26 dec 2026: samen met batch 1 elke dag één post | `feat/blog-geo-december` |
| 3 | nog te schrijven | vanaf zo 27 dec 2026 | — |

### Batch 2: zoekwoorden

| Datum | Post | Zoekwoord |
| --- | --- | --- |
| 26 nov | helpdesk-webshop-kiezen | helpdesk webshop |
| 28 nov | retouren-na-black-friday | retouren black friday |
| 1 dec | chatgpt-klantenservice-webshop | chatgpt klantenservice |
| 3 dec | ai-klantenservice-avg | ai klantenservice avg |
| 5 dec | betaling-mislukt-webshop | betaling mislukt webshop |
| 8 dec | verzendbevestiging-email | verzendbevestiging e-mail |
| 10 dec | reageren-op-negatieve-review | reageren op negatieve review |
| 12 dec | maattabel-webshop | maattabel webshop |
| 15 dec | klantenservice-whatsapp-instagram | klantenservice whatsapp webshop |
| 17 dec | levertijd-webshop-vermelden | levertijd webshop |
| 19 dec | retourbeleid-voorbeeld | retourbeleid webshop voorbeeld |
| 21 dec | tone-of-voice-klantenservice | tone of voice klantenservice |
| 22 dec | garantie-product-kapot | garantie webshop |
| 23 dec | ruilen-na-kerst | ruilen na kerst |
| 24 dec | klantenservice-omzet-verhogen | klantenservice omzet verhogen |
| 25 dec | automatische-ontvangstbevestiging | automatische ontvangstbevestiging e-mail |
| 26 dec | minder-klantvragen-webshop | minder klantvragen webshop |

De zoekwoorden zijn gekozen op zoekintentie (vragen die webshophouders echt typen, long tail, Nederlands), niet op gemeten zoekvolume: daar hadden we geen tool voor. Check ze in Search Console zodra er vertoningen zijn.

## GEO: zo schrijven we voor Google én AI-zoekmachines
Elke post vanaf batch 2 heeft:
- `summary:` in de front matter: een kort antwoord van 2–3 zinnen (25–85 woorden). Staat bovenaan als "Kort antwoord" en gaat mee als `abstract` in de BlogPosting-data. Dit is het stuk dat ChatGPT, Perplexity en Google AI Overviews het eerst citeren.
- Tussenkoppen als vragen ("Wat zegt de wet over levertijd?"), korte alinea's, lijsten en waar het past een tabel.
- `## Veelgestelde vragen` met minstens drie `### vraag?`: die worden automatisch FAQPage-data (`extractFaq` in `blogSchedule.ts`).
- Het zoekwoord in titel of beschrijving, interne links naar eerdere posts, en een eerlijk blok over wat Support One wel en niet doet.
- Eventueel `updated: 3 jan 2027` als een post inhoudelijk is bijgewerkt: dan "bijgewerkt" in de kop en `dateModified` in de data.
- Elke post krijgt BreadcrumbList-data, en `/llms.txt` somt alle live posts op met hun korte antwoord (ververst elk uur).

De test bewaakt dit voor alle posts met een `summary`, en dat er van 26 nov t/m 26 dec elke dag precies één post staat.

Ideeën voor batch 3: retourpiek in januari, WooCommerce-klantenservice, meertalige klantenservice (DE/BE), chargebacks, verzendkosten en gratis-verzendingsdrempel, Valentijnsdag, voorjaarscollectie inkopen, cadeaubonnen, klantenservice-software vergelijken.
