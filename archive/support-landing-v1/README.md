# Archief: de eerste Support One-landing

Gearchiveerd op 7 november 2026. Vervangen door `/support-one`
(`components/marketing/SupportOneLanding.tsx`): Seffy en Otis als team, en de
functies als kaarten die je openklikt.

| Bestand | Wat het was |
| --- | --- |
| `components/LandingPage.tsx` | De landing: hero met inbox-demo, productverhaal, werkwijze, prijsteaser, voorbeeldsituaties, FAQ, kennismaking |
| `components/SupportStory.tsx` | Het productverhaal in zes lange secties (bestelcontext, kennis, controle, stijl, mailbox, analytics) plus de pijnpuntensectie |
| `components/ScrollTilt.tsx` | Kanteleffect bij het scrollen, gebruikt door SupportStory |
| `app/page.tsx` | Stond op `support.sequenceflow.io/` |
| `app/for/[audience]/page.tsx` | De doelgroeppagina's `/for/webshops`, `/for/ecommerce-founders`, `/for/customer-service-teams` (inhoud in `lib/marketing/landingPages.ts`, die nog bestaat: de FAQ van `general` wordt op `/support-one` gebruikt) |

Nu stuurt `support.sequenceflow.io/` door naar `sequenceflow.io/support-one`
(of naar het dashboard als je bent ingelogd), en gaan `/for/*` en `/s1` met een
301 naar `/support-one`.

De CSS-klassen (`so-*`, `mk-workflow`, `mk-pricing-teaser`) staan nog in
`app/marketing.css`. Volledige stand van de site: git-tag `archief/site-met-content-one`.
