# Shopify App Store: indienen en eerste klant

Alles wat nodig is om "SequenceFlow Support" door de review te krijgen, en
daarna Guardian Beauty aan te sluiten. Technische setup: `docs/shopify-app-setup.md`.

## 0. Checklist vóór "Submit for review"

Code en database (Claude, na jouw go):
- [ ] Fase 1 op main (tweetalige app, voorbeeldvraag, plan-doorverwijzing).
- [ ] Migratie `049_shopify_sample_allowance.sql` op prod. Zonder deze migratie geeft de voorbeeldknop een foutmelding.

Partner Dashboard (jij):
- [ ] App Store-registratie betaald ($19, eenmalig).
- [ ] **Managed pricing**: maak de plannen Starter €49, Growth €129 en Scale €299 per maand, elk met 14 dagen proefperiode. Zonder actief plan opent de app alleen het keuzescherm voor een abonnement.
- [ ] Protected customer data, stap 2: de antwoorden staan in §3.
- [ ] Listing invullen (§1), met screenshots en een demovideo (§4).
- [ ] Reviewer-instructies (§2) plakken in "Testing instructions".

Vercel → Production (jij):
- [ ] `SHOPIFY_PARTNER_API_TOKEN` gezet. Zonder token kan de app niet zien welk plan een winkel heeft.
- [ ] **`SHOPIFY_PUBLIC_ROLLOUT=true` vlak vóór het indienen.** De reviewers van Shopify installeren op hun eigen winkel. Met alleen de allowlist krijgen ze "This shop has not been enabled" en wordt de app afgekeurd. Zolang de app niet goedgekeurd is, kan alleen Shopify (en je eigen dev store) hem installeren, dus dit opent niets voor het publiek.
- [ ] `SHOPIFY_BILLING_TEST_SHOPS` mag alleen je eigen dev store bevatten (bv. `sequenceflow-test.myshopify.com=pro`). Zet er nooit een reviewer- of klantwinkel in.
- [ ] Juridisch: branch `feat/shopify-legal` (privacy §2.4 en voorwaarden §6a) goedgekeurd en gemerged. De listing linkt naar /privacy.

## 1. Listing

**App name:** SequenceFlow Support

### English
- **Tagline:** AI drafts customer email replies with live Shopify order details.
- **Introduction:** Answer "where is my order?" emails in seconds. Every draft already knows the order, status and tracking.
- **Details:**
  SequenceFlow Support connects your support mailbox (Gmail, Outlook or any IMAP mailbox) to your Shopify orders. When a customer emails, it finds the right order, reads the status and tracking, and writes a reply in your tone of voice and the customer's language. You review and send it with one click, or let confident answers go out automatically. Nothing is sent before you choose to. Your FAQ, return policy and product information become the knowledge base for every draft.
- **Features:**
  - Drafts that include the customer's order, fulfilment status and tracking
  - Works with your existing Gmail, Outlook or IMAP support mailbox
  - Replies in the customer's language, in your brand's tone of voice
  - You approve every reply, or enable auto-send for confident answers
  - Read-only order access; customer data stays in your workspace
- **Pricing note:** 14-day free trial on every plan. Billed through Shopify.

### Nederlands
- **Tagline:** AI schrijft klantmails met live Shopify-bestelgegevens erbij.
- **Introductie:** Beantwoord "waar blijft mijn bestelling?" in seconden. Elk concept kent de bestelling, status en track & trace al.
- **Details:**
  SequenceFlow Support koppelt je supportmailbox (Gmail, Outlook of elke IMAP-mailbox) aan je Shopify-bestellingen. Als een klant mailt, vindt de app de juiste bestelling, leest de status en track & trace, en schrijft een antwoord in jouw toon en in de taal van de klant. Jij controleert en verstuurt met één klik, of laat zekere antwoorden automatisch versturen. Er gaat niets weg zonder dat jij dat kiest. Je FAQ, retourbeleid en productinformatie vormen de kennisbank voor elk concept.
- **Features:**
  - Concepten met de bestelling, verzendstatus en track & trace van de klant
  - Werkt met je bestaande Gmail-, Outlook- of IMAP-supportmailbox
  - Antwoordt in de taal van de klant, in de toon van je merk
  - Jij keurt elk antwoord goed, of zet automatisch versturen aan
  - Alleen leestoegang tot bestellingen; klantgegevens blijven in je werkruimte

**Categorie:** Customer support → Helpdesk.
**Links:** Privacy: https://support.sequenceflow.io/privacy · Support: support@sequenceflow.io (moet een inbox zijn die je leest).

## 2. Reviewer-instructies (plakken in "Testing instructions")

```
SequenceFlow Support drafts replies to customer support emails using the
merchant's Shopify order data. No login or external account is needed.

1. Install the app and choose a plan (all plans have a 14-day free trial;
   test charges are fine).
2. The app opens embedded in Shopify admin. Click "Get started".
   A workspace is created for your store automatically.
3. On the setup page, click "Try an example". The app creates a sample
   customer question about the most recent order in your store and opens the
   AI draft next to the order details (status, items, tracking). Create a
   test order first if your store has none. The sample comes from a reserved,
   undeliverable address and is never sent or billed.
4. Connecting a real support mailbox (Gmail/IMAP) is optional for the review.
   It needs the merchant's own mailbox credentials, so the sample covers the
   full flow without it.

Scopes: read_orders only (to show order status and tracking next to a customer
email). The app never writes to the store.
Compliance webhooks (customers/data_request, customers/redact, shop/redact)
and app/uninstalled are handled at /api/shopify/webhooks.
Contact: support@sequenceflow.io
```

## 3. Protected customer data (stap 2)

Antwoorden gebaseerd op wat de code nu echt doet. Vul alleen "ja" in waar het hier zo staat.

| Vraag (verkort) | Antwoord |
|---|---|
| Waarvoor gebruik je de gegevens? | Klantenservice: de bestelling van de klant naast diens e-mail tonen en een antwoord opstellen. |
| Alleen de minimale gegevens? | Ja. Alleen `read_orders`; we slaan ordernummer, status, regels en tracking op, plus de e-mail om bestelling en mail te koppelen. Geen betaalgegevens. |
| Klanten geïnformeerd / toestemming? | De merchant is verwerkingsverantwoordelijke; de verwerkersovereenkomst staat in voorwaarden §6a en het privacybeleid in §2.4. |
| Respecteer je opt-outs / verwerkingsbeperking? | Ja, via customers/redact en verwijderen op verzoek van de merchant. |
| Gegevens verwijderen op verzoek? | Ja. customers/redact verwijdert gecachte bestellingen en (bij een werkruimte die voor de winkel is gemaakt) de supportgesprekken. shop/redact verwijdert de werkruimte. |
| Bewaartermijn? | Gesprekken en gecachte bestellingen 90 dagen, spam 30 dagen, webhook-inhoud wordt na verwerking gewist, back-ups 14 dagen. |
| Versleuteld in rust en onderweg? | Ja. Alles via TLS. Supabase versleutelt in rust. Shopify-tokens staan daarnaast versleuteld met AES-256-GCM. |
| Test- en productiedata gescheiden? | **Te bevestigen door jou.** Eerlijk antwoord: testwinkels draaien op dezelfde productieomgeving, in een eigen afgeschermde werkruimte (tenant), en we gebruiken nooit echte klantgegevens om te testen. Vul "ja" alleen in als je dat zo aan Shopify wilt uitleggen. |
| Strategie tegen gegevensverlies (DLP)? | **Te bevestigen door jou.** Wat er is: Row Level Security (geen directe databasetoegang voor gebruikers), tokens alleen op de server, gegevens per werkruimte gescheiden, exacte e-mailmatching bij exports en verwijderingen, geen export door personeel. Er is geen apart DLP-product. |
| Toegang van personeel beperkt? | Ja. Alleen de beheerders (jij) hebben toegang tot de productiedatabase. |
| Sterke wachtwoorden / 2FA voor personeel? | Ja: GitHub, Supabase en Vercel met 2FA/passkey. |
| Toegang tot data gelogd? | Supabase en Vercel loggen API-toegang. Zeg "ja" alleen als je die logs ook bewaart en bekijkt. |
| Beveiligingsincidenten: plan? | Melden aan merchants binnen 72 uur (zoals in de verwerkersovereenkomst). |
| Subverwerkers? | Supabase (database, EU), Vercel (hosting), OpenAI (concepten; geen training op API-data), Resend (e-mail). |

## 4. Screenshots en video

Maak ze in de dev store, met Engelse admin-taal (de app volgt de taal van de admin):
1. Setup-pagina met "Try an example".
2. Een concept naast het bestelpaneel (status en tracking zichtbaar).
3. De inbox met een paar gesprekken.
4. Kennisbank (retourbeleid geüpload).
5. Abonnementpagina.

Formaat 1600×900. Toon geen echte klantnamen; de voorbeeldvraag gebruikt "Example customer".
Video (optioneel, aanbevolen): 60 tot 90 seconden met dezelfde stappen als de reviewer-instructies.

## 5. Guardian Beauty aansluiten (na goedkeuring)

Guardian Beauty: Shopify (headless, guardianbeauty.nl), klantvragen via Gmail.

1. **Installeren:** stuur de klant de App Store-link. Het eigen Shopify-domein (`*.myshopify.com`) staat in Shopify → Settings → Domains. Headless maakt niet uit: de app gebruikt alleen de Admin API.
2. **Plan kiezen:** Starter is genoeg om te beginnen; de proefperiode loopt 14 dagen.
3. **Get started:** de werkruimte wordt automatisch gemaakt.
4. **Gmail koppelen** (in de app, Instellingen → Mailbox):
   - In het Google-account van de supportmailbox: 2-stapsverificatie aan, dan een **app-wachtwoord** maken (Google-account → Beveiliging → App-wachtwoorden).
   - IMAP `imap.gmail.com:993` (SSL), SMTP `smtp.gmail.com:465` (SSL), gebruikersnaam is het volledige Gmail-adres, wachtwoord is het app-wachtwoord.
   - De klant vult dit zelf in. Vraag het app-wachtwoord nooit via mail of chat.
   - Bij Google Workspace moet de beheerder IMAP en app-wachtwoorden toestaan.
5. **Kennis:** upload het retourbeleid, de verzendinformatie en een FAQ (ingrediënten, allergieën, houdbaarheid). Dat zijn de vragen die beauty-klanten het vaakst stellen.
6. **Toon en handtekening:** in de agentinstellingen. Laat automatisch versturen de eerste twee weken **uit**: de klant keurt elk concept zelf goed.
7. **Controle na de eerste dag:** komen er mails binnen, zie je bestellingen naast de concepten, en gaat een verstuurd antwoord ook naar de map Verzonden in Gmail?
8. Gaat iets mis, kijk dan eerst in Vercel-logs naar `[shopify` en `[pipeline`.
