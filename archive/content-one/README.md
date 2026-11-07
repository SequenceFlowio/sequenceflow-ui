# Archief: Content One en de bedrijfspagina (hub)

Gearchiveerd op 7 november 2026. Content One was nog niet klaar, en een
bedrijfspagina met één product is vooral een extra klik. Zolang er één app is,
is `sequenceflow.io/support-one` de hoofdpagina. Komt er een tweede app (Content
One of iets anders), dan haal je dit terug.

De bestanden staan hier zoals ze live stonden. TypeScript en ESLint slaan
`archive/` over (`tsconfig.json`, `eslint.config.mjs`), dus imports mogen hier
kloppen of niet. Ze verwijzen nog naar `./X` en `@/...` alsof ze in
`components/marketing/` staan.

Vangnet: git-tag `archief/site-met-content-one` is de volledige site op het
moment van archiveren (main op `472a7f5`). `git checkout archief/site-met-content-one`
laat alles zien zoals het was.

## Wat er staat

| Bestand | Wat het was | Stond op |
| --- | --- | --- |
| `components/HubLanding.tsx` | Bedrijfspagina met beide producten | `app/home/page.tsx`, op `sequenceflow.io/` via een rewrite in `proxy.ts` |
| `components/HomeVariantH1.tsx` | Testvariant van de bedrijfspagina: twee klikbare tegels, probleem, over ons | `app/h1/page.tsx` (noindex) |
| `components/TileLink.tsx` | Maakt een hele tegel klikbaar (stretched link) | gebruikt door HomeVariantH1 |
| `components/BetaSignup.tsx` | E-mailaanmelding voor de Content One-beta | in de Content One-tegel op /h1 |
| `components/HubProductDemo.tsx`, `HubStoryVisuals.tsx`, `HeroMilo.tsx`, `HeroFilm.tsx` | Visuals van de bedrijfspagina (HeroFilm was al niet meer in gebruik) | HubLanding |
| `components/ContentLanding.tsx` | De Content One-productpagina | `app/content/page.tsx` |
| `components/LottieSlot.tsx`, `PhotoSlot.tsx`, `mediaSlots.ts` | Foto- en animatieplekken van de Content One-pagina (`mediaSlots.ts` stond in `lib/marketing/`) | ContentLanding |
| `components/ContentOneConcept.tsx` | Ontwerpstudie Content One | `app/design/content-one/page.tsx` |
| `components/SiteNavigation.with-products.tsx` | **De volledige navigatie**: menu "Producten" met app-preview (Support One-gesprek, Content One-fotogrid), "Bedrijf", en "Inloggen" met een keuze per app | `components/marketing/SiteNavigation.tsx` |
| `components/EnglishSite.with-hub.tsx` | Engelse site mét `EnglishHub` (Engelse bedrijfspagina) en het inlogkeuzemenu | `components/marketing/EnglishSite.tsx`, `/en` |
| `app/content`, `app/home`, `app/h1`, `app/design-content-one` | De route-bestanden (`page.tsx`) | `app/...` |
| `api/waitlist/route.ts` | Wachtlijst-API (honeypot, invultijd, limiet per IP, mail via Resend naar hallo@) | `app/api/marketing/waitlist/route.ts` |
| `css/marketing-hub.css` | Kopie: hub- (`hub-*`, `hs-*`), Content One- (`ct-*`) en navigatiestijlen (`sn-*`) | `app/marketing-hub.css` (staat er nog, want de navigatie gebruikt `sn-*`) |
| `css/marketing-h1.css` | Kopie: stijlen van /h1 (`h1-*`) | `app/marketing-h1.css` (staat er nog, want /support-one gebruikt `.h1-card`, `.h1-chip`, `.h1-ready`, `.h1-final`) |
| `css/english-hub.css` | De `en-hub-*`-regels van de Engelse bedrijfspagina | waren in `app/marketing.css` |

Foto's staan nog gewoon in `public/media/site/` (onder meer `content-post.jpg`,
`content-example-carousel.jpg`, `content-example-ugc.jpg`, `content-calendar.jpg`).
Fotobriefing: `docs/website-fotocontent.md`.

## Waar Content One nog wel staat (bewust)

- `lib/marketing/products.ts`: `PRODUCTS.content` (naam, href `/content`). Nodig voor types en de deelafbeelding `/og/content`.
- `lib/marketing/seo.ts` en `app/og/[variant]/route.tsx`: variant `content` en `hub` voor de deelafbeelding.
- `lib/marketing/siteChat.ts`: `ChatContext` `"content"` met persona Juno, begroeting en vaste vragen. Geen pagina gebruikt die context nu; het blok "Content One" is wel uit de gedeelde prompt gehaald.
- `components/marketing/MarketingFooter.tsx`: footerlinks voor context `content`.
- `app/api/marketing/meeting/route.ts`: onderwerp `content` ("Early access Content One").
- De app zelf (team-chat met Juno als early access) is niet aangeraakt.

## Terugzetten, stap voor stap

1. **Bestanden terug**: zet de componenten terug in `components/marketing/`, de routes in `app/` (`app/design-content-one` → `app/design/content-one`), en `api/waitlist` → `app/api/marketing/waitlist`. `mediaSlots.ts` → `lib/marketing/`.
2. **Navigatie**: vervang `components/marketing/SiteNavigation.tsx` door `SiteNavigation.with-products.tsx` (hernoemen), of zet de secties `products` en `login` en `ProductPreview`/`LoginLinks` terug in de huidige versie. Let op: de huidige navigatie heeft links naar Seffy en Otis; kies wat je wilt houden. De CSS voor het inlogkeuzemenu (`.sn-login`, `.sn-panel--login`, `.sn-login-links`) moet terug in `app/marketing-hub.css`; die staat onderaan de gearchiveerde `css/marketing-hub.css`.
3. **Routing** (`proxy.ts`):
   - `sequenceflow.io/` weer naar de hub: vervang de 307-redirect naar `/support-one` door `NextResponse.rewrite(new URL("/home", request.url))`.
   - Zet `/home` (of `/h1`), `/content` weer in `PUBLIC_PATHS`.
4. **Redirects** (`next.config.ts`): haal de tijdelijke redirects van `/content`, `/content/:path*`, `/content-gen`, `/home` en `/h1` weg.
5. **SEO-bestanden**: zet `/content` (en eventueel `""` voor de hub) terug in `app/sitemap.ts`; zet Content One terug in `app/llms.txt/route.ts` en in de prompt in `lib/marketing/siteChat.ts` (blok "Content One", hub-begroeting en vaste vragen).
6. **Footer**: Content One-link terug in `FOOTER_LINKS.hub` en `.support` (`MarketingFooter.tsx`); de bedrijfspagina's (`SitePage`) weer `product=""` met de hub-CTA.
7. **Engels**: `EnglishHub` terug uit `EnglishSite.with-hub.tsx`, `/en` weer de hub en de Support One-pagina weer op `/en/support-one` (en de redirect `/en/support-one` → `/en` in `next.config.ts` weghalen). CSS uit `css/english-hub.css` terug in `app/marketing.css`.
8. **Controleren**: `npx tsc --noEmit`, `npm test`, `npm run build`, en lokaal `/`, `/content`, het productmenu en `/en`.

Tip voor een LLM: lees eerst deze README en `git show archief/site-met-content-one --stat`, en vergelijk daarna `git diff archief/site-met-content-one -- components/marketing/SiteNavigation.tsx proxy.ts next.config.ts` om precies te zien wat er bij het archiveren veranderde.
