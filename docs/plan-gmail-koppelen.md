# Plan: Gmail koppelen zonder app-wachtwoord (optie B)

Status: concept, nog niet gebouwd. Codex-review volgt zodra er weer usage is.

## Doel

Een winkel koppelt Gmail zonder tweestapsverificatie en zonder app-wachtwoord:

1. **Ontvangen**: Gmail stuurt klantmail automatisch door naar het eigen SequenceFlow-adres van de winkel.
2. **Versturen**: de winkel klikt op "Inloggen met Google". Support One verstuurt antwoorden via de Gmail API vanaf het eigen adres. Ze komen gewoon in de map Verzonden.

Met alleen het recht `gmail.send` (bij Google "sensitive", niet "restricted") is volgens het beleid van Google geen jaarlijkse CASA-audit nodig. Wel moet Google de app verifiëren. **Dit moeten we nog nalezen in het actuele beleid van Google voordat we bouwen.**

## Wat de klant ziet

Op de Mailbox-pagina staat een nieuwe keuze bovenaan: **"Gmail (aanbevolen)"**.

**Stap 1: Inloggen met Google**
- De knop opent het Google-scherm in een nieuw venster. Google weigert in een iframe te laden, en de Shopify-app is een iframe.
- De klant kiest zijn supportaccount en geeft toestemming voor "E-mail namens jou versturen".
- Daarna sluit het venster en toont de app "Versturen gekoppeld: support@winkel.nl".

**Stap 2: Doorsturen aanzetten**
- De app toont het eigen doorstuuradres met een kopieerknop.
- Een knop opent direct de doorstuurinstellingen van Gmail (`mail.google.com/mail/u/0/#settings/fwdandpop`).
- De instructie heeft drie korte stappen: "Doorstuuradres toevoegen", het adres plakken, "Volgende".
- Gmail stuurt een bevestigingsmail naar ons. Die bevestigen wij automatisch, maar alleen als de aanvraag van het gekoppelde Google-adres komt.
- Daarna zet de klant "Een kopie doorsturen naar…" aan en klikt op "Opslaan".

**Stap 3: Test**
- De knop "Stuur testmail" stuurt via de Gmail API een mail van de winkel naar de winkel.
- Die komt via doorsturen terug in de Inbox van Support One. Dan zijn ontvangen en versturen allebei bewezen.
- De status loopt live mee: wacht op bevestiging → doorsturen actief → eerste mail ontvangen.

Het app-wachtwoord en IMAP blijven bestaan onder "Andere manier", voor wie dat liever doet.

## Techniek

### Database (migratie 050)
Nieuwe tabel `tenant_google_connections`, alleen toegankelijk voor de server (RLS aan, geen rechten voor anon of authenticated):

| Kolom | Inhoud |
|---|---|
| `tenant_id` | Uniek; één Google-account per werkruimte |
| `google_email`, `google_sub` | Identiteit van het gekoppelde account |
| `refresh_token_encrypted` | AES-256-GCM, zoals de Shopify-tokens |
| `scopes` | De rechten die Google echt heeft gegeven |
| `status` | `active` / `needs_reconnect` / `revoked` |
| `connected_at`, `last_used_at`, `last_error` | |

In `tenant_email_channels` komt `outbound_provider` (`smtp` / `gmail_api`, standaard `smtp`). Daarmee wordt de keuze expliciet, in plaats van "SMTP als het er is".

Voor het inlogproces komt er een tabel `google_oauth_states` (hash van de state, tenant, user, PKCE-verifier, verloopt na 10 minuten, eenmalig bruikbaar). Een cookie werkt niet goed vanuit een iframe naar een nieuw venster.

### Routes
- `POST /api/integrations/email/google/start` (alleen admin)
  - Maakt de state en PKCE aan en geeft de Google-URL terug.
  - Rechten: `openid email https://www.googleapis.com/auth/gmail.send`, `access_type=offline`, `prompt=consent`.
- `GET /api/integrations/email/google/callback`
  - Controleert de state: bestaat, niet verlopen, niet gebruikt.
  - Wisselt de code in met PKCE en controleert of `gmail.send` echt is gegeven.
  - Leest de identiteit uit het id_token, slaat versleuteld op en zet `outbound_provider=gmail_api`.
  - Toont een korte pagina die het venster sluit (`window.opener.postMessage` naar onze eigen origin) of terugstuurt.
- `DELETE /api/integrations/email/google`: trekt het token in bij Google, wist het en zet versturen terug op `smtp`.
- `POST /api/integrations/email/google/test`: stuurt de testmail van stap 3.
- In de Shopify-app: deze routes toevoegen aan `shopifyApiAllowed`, alleen voor admins. De callback hoeft daar niet bij: die draait in het nieuwe venster en vertrouwt op de state, niet op een sessie.

### Versturen (`lib/email/outbound/mailer.ts`)
- `sendTenantEmail` kiest op `outbound_provider`:
  - **`gmail_api`**: MIME opbouwen (nodemailer MailComposer: From, To, Subject, In-Reply-To, References, bijlagen), dan `users.messages.send`.
  - **`smtp`**: zoals nu.
- De Gmail API zet het bericht zelf in Verzonden, dus `appendToSent` is daar niet nodig.
- **Afzender:** From is altijd het gekoppelde `google_email`. Wijkt het supportadres daarvan af, dan weigert het koppelen met een duidelijke melding. Aliassen ("Verzenden als") zijn voor later.
- **Draadjes:** zonder leesrecht kennen we de Gmail-threadId niet. De klant ziet het antwoord wel netjes in hetzelfde gesprek (via In-Reply-To en References). In Verzonden van de winkel staat het mogelijk als los bericht. Dat accepteren we voor nu.
- **Fouten:**
  - Toegangstoken verlopen: vernieuwen met het refresh-token. Een lock zoals bij Shopify voorkomt dubbel vernieuwen.
  - `invalid_grant` (toegang ingetrokken of wachtwoord gewijzigd): status `needs_reconnect`. Dan **geen** stille terugval naar versturen vanaf een ander adres. Het concept blijft staan en de app toont "Opnieuw inloggen met Google".
- De bestaande bewaking blijft gelden: voorbeeldgesprekken (`.invalid`) kunnen nooit verstuurd worden.

### Doorstuur-bevestiging (`handleGmailForwardingVerification`)
Nu bevestigt dit **elke** doorstuuraanvraag automatisch, ook van een vreemd adres. Dat wordt strenger:
- Haal het aanvragende adres uit de bevestigingsmail ("x@gmail.com has requested…") en zoek de werkruimte via het ontvangstadres.
- Bevestig alleen als dat adres gelijk is aan het gekoppelde Google-adres of het ingestelde supportadres van die werkruimte.
- Is dat niet zo, dan niets doen en loggen.
- Sla de status op (`forwarding_status`: pending / confirmed) en de bevestigingscode, zodat de app de voortgang kan tonen. Lukt automatisch bevestigen niet, dan kan de klant de code handmatig in Gmail plakken.

### Juridisch en Google-verificatie
- Het privacybeleid krijgt een alinea "Google API Services User Data Policy, inclusief Limited Use": alleen versturen namens de gebruiker, geen opslag van mailinhoud via Google, geen verkoop of training. Google eist die tekst voor de verificatie.
- Een korte demovideo van het inloggen, net als bij Shopify.

## Wat jij moet regelen (Google Cloud)
1. Een Google Cloud-project onder het SequenceFlow-account.
2. **OAuth-toestemmingsscherm** op "External":
   - App-naam Support One, logo, support-mail, privacy- en voorwaarden-URL.
   - Domein `sequenceflow.io` geverifieerd in Search Console.
3. Rechten: `openid`, `email` en `gmail.send`.
4. OAuth-client van het type "Web application" met redirect `https://support.sequenceflow.io/api/integrations/email/google/callback`. De client-ID en het geheim zet jij in Vercel (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`).
5. Verificatie aanvragen. Dat duurt vaak een paar weken.
   - Tot de goedkeuring kunnen maximaal 100 "testgebruikers" het al gebruiken, met een waarschuwing "niet geverifieerde app".
   - **Let op:** in de testmodus verloopt het refresh-token volgens Google na 7 dagen. Voor Guardian Beauty betekent dat wekelijks opnieuw inloggen, of in de pilot het app-wachtwoord houden.

## Fasering
1. **Bouwen** (ongeveer 3–4 dagen):
   - de migratie
   - de koppelroutes
   - versturen via de Gmail API
   - strengere doorstuur-bevestiging
   - de nieuwe Mailbox-stappen in het Nederlands en het Engels
   - tests voor state, PKCE, scope-controle, de afzender-controle en verlopen of ingetrokken tokens
2. **Codex-review**, daarna de fixes.
3. **Achter een schakelaar live** (`GOOGLE_SEND_ENABLED`), eerst alleen onze eigen test-Gmail.
4. **Google-verificatie** aanvragen met de video en de privacytekst.
5. **Na goedkeuring:** Gmail als aanbevolen keuze voor iedereen. Pas dan de App Store-listing aanpassen ("Connect Gmail in one click").

## Open vragen
- Onder welk Google-account maken we het Cloud-project aan? Het liefst een account van SequenceFlow, niet een persoonlijk account.
- Is `sequenceflow.io` al geverifieerd in Google Search Console?
- Willen we later ook "Verzenden als"-aliassen? Daar is een extra recht voor nodig (`gmail.settings.basic`, ook sensitive).
- Werkt het wel bij Google Workspace? Beheerders kunnen externe apps blokkeren. Dan moet de beheerder Support One toestaan, of gebruikt de winkel het app-wachtwoord.
