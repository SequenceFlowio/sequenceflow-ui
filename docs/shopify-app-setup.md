# Shopify-app: wat je buiten de code regelt

De code staat op de branch `feat/shopify-app`. Alles hieronder gebeurt in Shopify, Supabase en Vercel. Werk de stappen in volgorde af.

**Wat de app doet:** Support One draait binnen de Shopify-admin. Het leest bestellingen (alleen-lezen) en gebruikt ze bij klantmails. De winkel betaalt via Shopify. Een concept wordt pas verstuurd nadat iemand het heeft goedgekeurd.

---

## 1. Shopify Partner-dashboard

1. **Maak een publieke app aan:** Apps → Create app → handmatig. De werktitel is *SequenceFlow Support*.
2. **Noteer de gegevens:**
   - de *Client ID* (dit wordt `SHOPIFY_API_KEY`),
   - de *Client secret* (dit wordt `SHOPIFY_API_SECRET`),
   - de *app handle* (het stuk in de app-URL; dit wordt `SHOPIFY_APP_HANDLE`).
3. **Vraag direct toegang aan tot beschermde klantgegevens:** API access → Protected customer data.
   - **Level 1:** kies *Orders*.
   - **Level 2:** kies het veld *Email*. Support One koppelt een klantmail aan een bestelling via het e-mailadres van de klant.
   - **Reden:** "Klantenservice: bij een klantmail de bijbehorende bestelling tonen aan de medewerker die het antwoord goedkeurt."

   Zonder goedkeuring faalt de knop *Test bestelcontext* met een melding hierover.
4. **Zet de prijzen op** onder Pricing → Shopify App Pricing (managed pricing):
   - **Plannen:**

     | Plan | Handle | Prijs |
     |---|---|---|
     | Starter | `starter` | €49 per maand |
     | Growth | `growth` | €129 per maand |
     | Scale | `scale` | €299 per maand |

   - **Proefperiode:** 14 dagen, op alle drie de plannen.
   - **Andere handles?** Zet ze dan in `SHOPIFY_STARTER_ITEM_HANDLE`, `SHOPIFY_GROWTH_ITEM_HANDLE` en `SHOPIFY_SCALE_ITEM_HANDLE`.
5. **Partner API-token** (voor de abonnementsstatus): Settings → Partner API clients → maak een token met toegang tot *Manage apps*. Noteer:
   - het token: `SHOPIFY_PARTNER_API_TOKEN`,
   - het organisatie-ID uit de URL van het Partner-dashboard: `SHOPIFY_PARTNER_ORGANIZATION_ID` (alleen cijfers),
   - het app-ID als `gid://shopify/App/<nummer>`: `SHOPIFY_PARTNER_APP_ID`.
6. **Maak een ontwikkelwinkel aan** om te testen: Stores → Add store → Development store. Zet er een paar testbestellingen in, met het e-mailadres van je testmailbox als klant.

## 2. Aparte Supabase-omgeving voor de test

De app weigert te starten op een andere database dan de testdatabase, zolang de pilot nog niet publiek is. Zo kan hij niet per ongeluk op productie draaien.

1. **Maak een nieuw Supabase-project**, bijvoorbeeld *sequenceflow-shopify-test*.
2. **Draai daar alle migraties uit `supabase/migrations/`,** tot en met `046_shopify_public_app.sql`.
3. **Noteer de project-URL:** die wordt `SHOPIFY_SANDBOX_SUPABASE_URL`, en ook `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` van de testomgeving.

## 3. Vercel: omgevingsvariabelen voor Preview

Zet deze variabelen alleen op **Preview**, gekoppeld aan de branch `feat/shopify-app`. Productie blijft zo onaangeroerd.

| Variabele | Waarde |
|---|---|
| `SHOPIFY_PUBLIC_APP_ENABLED` | `true` |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | uit stap 1.2 |
| `SHOPIFY_APP_HANDLE` | uit stap 1.2 |
| `SHOPIFY_ALLOWED_SHOPS` | `jouw-ontwikkelwinkel.myshopify.com` (meerdere gescheiden door komma's) |
| `SHOPIFY_PUBLIC_ROLLOUT` | `false` |
| `SHOPIFY_SANDBOX_SUPABASE_URL` | URL uit stap 2 |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | van het testproject |
| `SHOPIFY_PARTNER_ORGANIZATION_ID`, `SHOPIFY_PARTNER_APP_ID`, `SHOPIFY_PARTNER_API_TOKEN` | uit stap 1.5 |
| `SHOPIFY_PRIVACY_CONTACT_EMAIL` | optioneel, standaard hallo@sequenceflow.io (ontvangt gegevensverzoeken als het winkeladres onbekend is) |

De overige variabelen neem je over van productie: `COMMERCE_IDENTITY_HMAC_KEY`, `COMMERCE_CREDENTIAL_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY` en `CRON_SECRET`.

Een aandachtspunt: Vercel draait crons alleen op productie. Op een preview worden Shopify-meldingen (bestelupdates en privacyverzoeken) dus opgeslagen, maar niet vanzelf verwerkt. Verwerk ze tijdens het testen met de hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<preview-url>/api/cron/shopify-webhooks
```

## 4. App-configuratie koppelen

1. **Maak de configuratie:** kopieer `shopify.app.toml.example` naar `shopify.app.toml` en vul de `client_id` en de preview-URL in.
2. **Zet hem live** met de Shopify CLI: `shopify app deploy`. Daarmee staan rechten (`read_orders`), webhooks en de verplichte privacy-webhooks goed.
3. **Controleer de webhook-versie:** in het Partner-dashboard moet die op `2026-07` staan.

## 5. Testen op de ontwikkelwinkel

1. **Installeer de app** op de ontwikkelwinkel.
2. **Kies bij de eerste keer openen** *Nieuwe werkruimte*.
   - Test ook eens *Bestaande werkruimte koppelen*: log in op Support One (testomgeving) → Koppelingen → Shopify-app → *Koppelcode maken*.
3. **Richt de werkruimte in:**
   - Onder *Mailbox* koppel je de testmailbox.
   - Druk op *Test bestelcontext*. Die moet een bestelling vinden.
4. **Test de hele keten:** mail als klant naar de testmailbox → het concept toont de juiste bestelling → keur het concept goed → het antwoord komt aan.
5. **Test de randgevallen:**
   - een klant zonder bestelling,
   - een klant met twee bestellingen (de app moet naar het ordernummer vragen),
   - een medewerker die geen eigenaar is (die kan geen instellingen wijzigen),
   - verwijderen en opnieuw installeren (de werkruimte blijft bestaan).
6. **Test de abonnementen:** *Abonnement* → *Abonnement kiezen of wijzigen*. Probeer alle drie de plannen en de proefperiode. Er mag nergens een Stripe-scherm verschijnen.
7. **Test de privacyverzoeken:** in het Partner-dashboard kun je testmeldingen sturen voor `customers/data_request`, `customers/redact` en `shop/redact`. Draai daarna de cron (zie stap 3) en controleer:
   - **data_request:** de winkel krijgt een mail met `klantgegevens.json`,
   - **customers/redact:** de gesprekken van die klant zijn weg,
   - **shop/redact** (na het verwijderen van de app): een voor de winkel aangemaakte werkruimte is helemaal weg; een gekoppelde werkruimte houdt alles behalve de Shopify-gegevens.

## 6. Indienen bij Shopify

- **Listing:**
  - naam, korte beschrijving, schermafbeeldingen en een korte demovideo van de flow uit stap 5.4,
  - privacybeleid: `https://support.sequenceflow.io/privacy`,
  - supportadres: hallo@sequenceflow.io.
- **Instructies voor de reviewer:**
  - een ontwikkelwinkel met bestellingen,
  - de gegevens van de testmailbox, zodat de reviewer zelf een klantmail kan sturen,
  - de stappen uit 5.2 tot en met 5.4.

  Zonder mailbox ziet de reviewer een lege app en wordt die afgekeurd.
- **Doorlooptijd:** de review duurt meestal enkele weken. Reageer snel op vragen van de reviewer.

## 7. Na goedkeuring: de live pilotwinkel

1. **Draai migratie 046 op productie.**
2. **Zet de Shopify-variabelen op Production.** Houd `SHOPIFY_PUBLIC_ROLLOUT=false` en `SHOPIFY_ALLOWED_SHOPS=<pilotwinkel>.myshopify.com`.
3. **Zet de database-controle bewust op productie:** `SHOPIFY_SANDBOX_SUPABASE_URL` wordt nu de productie-URL. Zonder die stap weigert de app te starten.
4. **Zet de app-URL in `shopify.app.toml`** op `https://support.sequenceflow.io/shopify` en deploy de configuratie.
5. **Laat de pilotklant installeren.** Heeft de klant al een Support One-werkruimte, laat die dan *Bestaande werkruimte koppelen* kiezen met een koppelcode. Heeft de klant een Stripe-abonnement, zeg dat dan op nadat de koppeling klaar is.
6. **Openen voor alle winkels:** pas na een geslaagde praktijkcontrole. Zet dan `SHOPIFY_PUBLIC_ROLLOUT=true`.
