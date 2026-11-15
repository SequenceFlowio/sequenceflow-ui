# Doorverwijzen en affiliates

Twee programma's, één code: `lib/referrals/program.ts` (regels en bedragen) en `lib/referrals/server.ts` (database en Stripe). Migratie `059_referrals_affiliates.sql`.

| | Doorverwijzen | Affiliate |
|---|---|---|
| Voor wie | Klanten (in de app: Instellingen → Doorverwijzen) | Iedereen, met of zonder account (sequenceflow.io/affiliate) |
| Link of code | `sequenceflow.io/r/k-xxxxxx`, of code `k-xxxxxx` | `sequenceflow.io/r/<gebruikersnaam>`, of code `<gebruikersnaam>` |
| Beloning | 20% van het eigen maandbedrag als tegoed per nieuwe betalende klant, max 5 (Starter €15,80, Growth €45,80, Scale €109,80); nieuwe klant krijgt 10% korting op de eerste maand | 10% van wat de klant betaalt, zolang die klant blijft; de klant krijgt 10% korting op de eerste maand |
| Wachttijd | 30 dagen na de eerste betaling | 60 dagen na elke betaling |
| Uitbetaling | Automatisch als Stripe-saldo, verrekend met de volgende factuur | Maandelijks per bankoverschrijving, zonder minimum (zie hieronder) |

## Hoe het loopt

1. `/r/<code>` zet cookie `sf_ref` op `.sequenceflow.io` (60 dagen, laatste klik telt) en stuurt door naar de site.
2. Bij de eerste login maakt `auth/callback` de workspace en koppelt die aan de doorverwijzer of affiliate (`tenants.referred_by_tenant_id` / `tenants.affiliate_id`). Zichzelf doorverwijzen telt niet.
   - Een **code** werkt hetzelfde: op het aanmeldscherm zet `/api/partner-code` dezelfde cookie, en tijdens de proef koppelt Instellingen → Abonnement (`/api/referrals/code`) de werkruimte alsnog, zolang er nooit is betaald (`canClaimCode`).
3. De eerste checkout van een doorverwezen klant of een klant van een affiliate zet 10% van het gekozen plan als tegoed op hun Stripe-saldo (`welcomeDiscountRate`).
4. Stripe-webhook `invoice.paid` boekt een regel in `referral_rewards` (bedrag excl. btw, alleen wat echt betaald is). `charge.refunded` en `charge.dispute.created` zetten regels die nog niet zijn uitbetaald op `reversed`.
5. Cron `/api/cron/referrals` (dagelijks 05:00) zet regels na de wachttijd op `available` en zet tegoed voor doorverwijzers op hun Stripe-saldo, berekend over hun plan op dat moment (proef, verlopen of Shopify: blijft staan).

Workspaces die via Shopify App Pricing betalen tellen nog niet mee: daar komt geen Stripe-factuur binnen.

## Setup

- Migratie 059 uitvoeren.
- In Stripe → Webhooks de events `charge.refunded` en `charge.dispute.created` aan het bestaande endpoint toevoegen (naast `invoice.paid`).
- Leaderboard: toont testcijfers (beta) tot `AFFILIATE_LEADERBOARD_LIVE=true` in Vercel staat.

## Affiliates uitbetalen (maandelijks)

Migratie `072_affiliate_payouts.sql` uitvoeren (twee nieuwe tabellen; zonder de migratie toont de backoffice alleen wie er klaarstaat).

1. De affiliate vult in zijn dashboard (link uit de aanmeldmail) een rekeninghouder en IBAN in. Het IBAN staat versleuteld (`COMMERCE_CREDENTIAL_ENCRYPTION_KEY`).
2. `sequenceflow.io/backoffice` → Doorverwijzingen en affiliates → **Uitbetalen** toont wie vrijgegeven commissie heeft (geen minimum), met IBAN, btw en het bedrag om over te maken.
3. Maak het bedrag over bij de bank en klik **Uitbetaald**. Dat zet de vrijgegeven regels op `paid` (`settlement_ref` = id van de uitbetaling), boekt een regel in `affiliate_payouts`, maakt de self-billingfactuur (`SB-<jaar>-<nummer>`) en mailt de affiliate. Er wordt geen geld verplaatst door de site.

Btw (21%) komt er alleen bovenop als de affiliate ondernemer is en een btw-nummer heeft opgegeven. De factuur toont onze gegevens uit `COMPANY_LEGAL_NAME`, `COMPANY_ADDRESS`, `COMPANY_VAT_NUMBER` (optioneel; KvK staat vast).

Code: `lib/referrals/payouts.ts` (database), `lib/referrals/payoutCore.ts` (IBAN-controle, btw, factuurnummer).

Particulieren (geen KvK): uitbetalingen moeten mogelijk worden gemeld aan de Belastingdienst (renseigneringsverplichting); laat de boekhouder dit bevestigen.
