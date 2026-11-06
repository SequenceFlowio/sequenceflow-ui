# Google-login: eerste poging mislukt (3 november 2026)

## Vastgesteld

Productielog van `/auth/callback`: `PKCE code verifier not found in storage` bij de gemelde mislukte poging. Dit verklaart de callbackfout; waarom de browsercookie in die specifieke poging ontbrak, is niet vastgesteld.

## Gerichte wijziging

- Login navigeert naar `/auth/start`, dat met `@supabase/ssr` de Google-aanvraag start en de bijbehorende PKCE-cookie op dezelfde redirectresponse zet.
- Start en callback gebruiken dezelfde Supabase-URL (publieke URL eerst). Niet-vertrouwde previewhosts gaan vóór het starten naar de geconfigureerde apphost.
- De route geeft geen cachebare OAuth-responses. Een mislukte start geeft een begrijpelijke foutmelding.
- Werkruimteprovisioning blijft intact: Ezra werkt daarop op `claude/amazing-heisenberg-j275bj`. Bij samenvoegen zijn de wijzigingen in de callback aanvullend (alleen de Supabase-URL-regel).

## Gecontroleerd

Vier gerichte tests geslaagd, inclusief cryptografische overeenkomst tussen cookieverifier en challenge, vervanging van oude verifier en bestemming na login. ESLint voor gewijzigde bestanden en productiebuild geslaagd. Echte lokale route: HTTP 307 naar Supabase authorize, verificatiecookie aanwezig, callback `/auth/callback`, bestemming `/dashboard`, no-store.

Nog te verifiëren na release: eerste Google-login in een schone browsersessie en in de browser waarin de fout optrad. Geen Google- of Supabase-console-instellingen gewijzigd.
