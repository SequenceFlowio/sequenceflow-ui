# Outlook en Microsoft 365 koppelen ("Inloggen met Microsoft")

Roadmap nummer 1, branch `feat/outlook-koppelen` (bouwer: Claude).

## Wat het doet

- De winkel klikt op "Inloggen met Microsoft" en kiest zijn Outlook- of Microsoft 365-account.
- **Ontvangen:** elke minuut haalt de cron `/api/cron/process-emails` nieuwe mail uit de inbox op via Microsoft Graph. Doorsturen is niet nodig.
  - Alleen mail die binnenkomt na het koppelen wordt gelezen.
  - Uit Ongewenste e-mail halen we alleen antwoorden die bij een bestaand gesprek horen.
- **Versturen:** via Graph `sendMail`, vanaf het eigen adres. Outlook bewaart de mail zelf bij Verzonden items.
- **Rechten:**
  - Wel: `Mail.Read`, `Mail.Send`, `User.Read` en `offline_access`.
  - Nooit: `Mail.ReadWrite`. We kunnen mail dus niet verplaatsen, markeren of verwijderen.
- **Geen betaalde audit:** Microsoft vraagt alleen een gratis uitgeversverificatie, dus geen CASA zoals Google.

## Code

| Onderdeel | Bestand |
|---|---|
| Pure helpers en tests | `lib/email/microsoft/core.ts`, `tests/microsoft-mail.test.ts` |
| Inloggen, tokens en versturen | `lib/email/microsoft/connection.ts` |
| Ophalen | `lib/email/microsoft/syncMailbox.ts` (aangeroepen vanuit `app/api/cron/process-emails`) |
| Routes | `app/api/integrations/email/microsoft/{start,callback,test}` en `DELETE /api/integrations/email/microsoft` |
| Scherm | `app/(app)/settings/MicrosoftMailboxConnect.tsx`, in de mailboxinstellingen |
| Database | migratie 055: `tenant_microsoft_connections`, `microsoft_oauth_states`, `outbound_provider` 'microsoft_graph' (toegepast op 26 okt) |

## Eenmalig instellen

### In Azure

Ga naar portal.azure.com → Microsoft Entra ID → App registrations.

1. **New registration**
   - Naam: `Support One`.
   - Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*.
   - Redirect URI, type Web: `https://support.sequenceflow.io/api/integrations/email/microsoft/callback`.
2. **API permissions** → Add a permission → Microsoft Graph → Delegated: `Mail.Read`, `Mail.Send`, `User.Read`, `offline_access`.
   - Geen admin consent geven; elke winkel geeft zelf toestemming.
3. **Certificates & secrets** → New client secret, 24 maanden. Bewaar de waarde alleen in Vercel.
4. **Branding & properties**
   - Logo, homepage `https://support.sequenceflow.io`, privacy- en voorwaardenlinks.
   - Publisher domain: `sequenceflow.io`.
5. **Publisher verification** (gratis): koppel een Microsoft AI Cloud Partner Program-ID.
   - Zonder deze verificatie blokkeren veel bedrijven met Microsoft 365 de toestemming voor "unverified" apps.
   - Persoonlijke Outlook.com-accounts werken ook zonder verificatie.

### In Vercel (project supportflow, Production)

- `MICROSOFT_OAUTH_CLIENT_ID`: de Application (client) ID
- `MICROSOFT_OAUTH_CLIENT_SECRET`: de secret-waarde
- `MICROSOFT_MAIL_ENABLED=true`
- `MICROSOFT_MAIL_TENANT_IDS`: eerst alleen onze eigen werkruimte. Leeg betekent iedereen.

## Nog te testen voor live

- [ ] Koppelen met een Outlook.com-testaccount en met een Microsoft 365-account.
- [ ] Een klantmail komt binnen een minuut binnen.
- [ ] Antwoord versturen: staat het bij Verzonden items?
- [ ] Antwoordt de klant op ons antwoord, dan komt dat in hetzelfde gesprek. Dit hangt ervan af of Exchange onze Message-ID laat staan.
- [ ] Ontkoppelen en opnieuw koppelen.
- [ ] Een Microsoft 365-organisatie die toestemming blokkeert, toont de beheerdersmelding.

## Later

- Oude mail ophalen om het agentprofiel te leren, zoals `fetchMailboxHistory` voor IMAP.
- Push-meldingen (Graph change notifications) in plaats van elke minuut ophalen, als het aantal mailboxen groeit.
