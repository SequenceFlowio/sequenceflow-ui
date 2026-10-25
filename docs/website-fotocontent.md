# Fotocontent en animaties voor sequenceflow.io

Briefing voor de fotoplekken en Lottie-animaties op de bedrijfspagina (`/` op sequenceflow.io, code in `components/marketing/HubLanding.tsx`) en de Content One-landing (`/content`, `components/marketing/ContentLanding.tsx`).

## Zo voeg je een foto toe

1. Zet het bestand in `public/media/site/`, met de slot-id als naam (bijvoorbeeld `hub-hero.jpg`).
2. Vul in `lib/marketing/mediaSlots.ts` bij die plek `src: "/media/site/hub-hero.jpg"` in.
3. Klaar. Zolang `src` leeg is, toont de site een donkere lege plek. In development staat de briefing er zichtbaar in.

Formaat: lever minstens 2× de weergavegrootte aan (hero: 2400 px breed, kaarten: 1400 px, staand: 1200 px). Gebruik JPG of WebP, onder 400 kB.

## Huisstijl voor alle beelden

- **Donker en warm.** De site is zwart (#0a0a0a) met limoengroen (#c7f56f) als accent. Kies beelden met donkere achtergronden, avondlicht en gedempte kleuren, zodat ze niet uit de pagina springen.
- **Een klein limoen accent** in beeld (een sticker, een label, een lampje) verbindt foto en site.
- **Echt e-commerce.** Verzenddozen, verzendlabels, productrekken en een laptop met een webshop-backend. Geen stock-kantoor met pakken.
- **Een ondernemer, geen team.** De doelgroep doet alles zelf. Toon één persoon, liefst van achteren of met de handen in beeld, zodat iedereen zich erin herkent.
- **Geen tekst in de foto.** De site heeft de tekst al. Uitzondering zijn de voorbeeldposts van Content One.

## Bedrijfspagina (`/`)

| Slot-id | Formaat | Waar | Idee |
|---|---|---|---|
| `hub-hero` | 16:9 (mobiel bijgesneden naar 4:3) | Grote foto onder de hero, met twee zwevende kaartjes erop | Een ondernemer in een kleine webshopstudio, 's avonds. Laptop open, stapel verzenddozen, een productrek op de achtergrond, warm bureaulamplicht. Houd linksonder en rechtsboven wat rust in beeld, want daar zweven de kaartjes "Support One" en "Content One". |
| `hub-support` | 4:3 | Productkaart Support One | Close-up van handen op een laptop met een inbox, kop koffie en een verzendlabel ernaast. Rustig en overzichtelijk, de inbox onder controle. Rechtsonder ligt een kleine animatie over het beeld. |
| `hub-content` | 4:3 | Productkaart Content One | Een telefoon op een statief filmt een product op een donkere ondergrond, met een ringlamp aan. Op het scherm is een Reel in de maak te zien. |
| `hub-shop-fashion` | 3:4 staand | Rij "Voor webshops zoals de jouwe" | Fashion: een kledingrek met de nieuwe collectie en verzendzakken klaar. Het label "Mode & accessoires" staat linksonder in beeld. |
| `hub-shop-beauty` | 3:4 staand | idem | Beauty/skincare: flesjes en potjes op een stenen ondergrond, met een half open doos met vulmateriaal. |
| `hub-shop-home` | 3:4 staand | idem | Home & living: een vaas, een kaars en een plaid op een donkere houten tafel, sfeervol. |

## Content One-landing (`/content`)

| Slot-id | Formaat | Waar | Idee |
|---|---|---|---|
| `content-product` | 1:1 | Hero-demo, kaartje "Uit je webshop" | De "invoer": een schone packshot van één product op een effen lichtgrijze achtergrond, zoals in een webshop. De demo noemt nu een witte leren sneaker. Kies je een ander product, pas dan ook de naam en prijs aan in `ContentLanding.tsx`. |
| `content-post` | 4:5 | Hero-demo, Instagram-post | De "uitvoer": hetzelfde product in een lifestylescène, klaar als post. Bijvoorbeeld de sneaker op straat bij avondlicht, of op een skateboard. Het moet duidelijk hetzelfde product zijn als de packshot. |
| `content-calendar` | 16:10 | Functie 03, contentkalender | Een laptop of scherm met een maandkalender vol kleine postthumbnails, in een donkere UI. Een mockup of screenshot van een (toekomstige) app-weergave mag ook. |
| `content-example-carousel` | 4:5 | Rij "Van packshot naar scrollstopper" | De eerste slide van een carrousel: product plus een korte hook, bijvoorbeeld "3 manieren om je witte sneakers te stylen". Hier mag tekst in beeld. |
| `content-example-lifestyle` | 4:5 | idem | Het product in gebruik, in een echte omgeving: een badkamerplank, een straat of een woonkamer. Natuurlijk licht. |
| `content-example-ugc` | 4:5 | idem | Een still uit een UGC-achtige video: iemand houdt het product in de camera, met ondertitels in beeld ("Eindelijk sneakers die…"). |

Tip: maak de drie voorbeeldposts en `content-post` met hetzelfde product. Dan vertelt de pagina één verhaal: één productfoto wordt een week aan content.

## Lottie-animaties

Ze staan in `public/lottie/` en worden gegenereerd door `scripts/marketing/generate-lottie.mjs`. Ze spelen alleen af zolang ze in beeld zijn, en bij "reduced motion" blijven ze stilstaan. Je kunt elk bestand vervangen door een eigen animatie (bijvoorbeeld van LottieFiles) met dezelfde bestandsnaam. Houd daarbij de zwart-limoen kleuren aan en gebruik geen expressions: de lichte speler ondersteunt die niet.

| Bestand | Waar | Wat het nu doet | Idee voor een rijkere versie |
|---|---|---|---|
| `hub-flow.json` | Bedrijfspagina, "Samen sterker" | Webshop in het midden, signalen naar Support One en Content One en terug | De mascotte in het midden, met mailtjes die naar links vliegen en posts die naar rechts vliegen |
| `support-check.json` | Productkaart Support One | Berichtregels komen binnen, daarna verschijnt een vinkje | Een mail die openvouwt en een antwoordconcept dat zichzelf typt |
| `content-stack.json` | Productkaart Content One en functie 01 op `/content` | Drie posts schuiven binnen en krijgen een like | Een productfoto die zich opsplitst in een post, een carrousel en een Reel-frame |
| `pulse.json` | Hero-demo op `/content`, tussen product en post | Pulserende limoen stip | Een toverstaf- of vonkeffect: "hier gebeurt het" |

Extra plekken waar een Lottie goed zou werken (nog niet gebouwd): de drie kaartjes "Voor ondernemers die alles zelf doen" (nu iconen), en de stappen 01–03 bij "Zo werkt het" op `/content`.

## Naam voor de contentgenerator

"Content One" is een werktitel. Je verandert de naam op één plek: `PRODUCTS.content.name` in `lib/marketing/products.ts`. De URL `/content` blijft dan gewoon werken.
