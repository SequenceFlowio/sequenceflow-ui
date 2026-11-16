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
| 2 | nog te schrijven | vanaf ma 21 dec 2026 | — |

Ideeën voor batch 2: retourpiek in januari, WooCommerce-klantenservice, meertalige klantenservice (DE/BE), klantenservice en reviews, chargebacks, verzendkosten en drempels, Valentijnsdag, voorjaarscollectie inkopen, cadeaubonnen.
