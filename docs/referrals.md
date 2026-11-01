# Doorverwijzen en affiliates

Twee programma's, één code: `lib/referrals/program.ts` (regels en bedragen) en `lib/referrals/server.ts` (database en Stripe). Migratie `059_referrals_affiliates.sql`.

| | Doorverwijzen | Affiliate |
|---|---|---|
| Voor wie | Klanten (in de app: Instellingen → Doorverwijzen) | Iedereen, met of zonder account (sequenceflow.io/affiliate) |
| Link | `sequenceflow.io/r/k-xxxxxx` | `sequenceflow.io/r/<gebruikersnaam>` |
| Beloning | 20% van het eigen maandbedrag als tegoed per nieuwe betalende klant, max 5 (Starter €15,80, Growth €45,80, Scale €109,80); nieuwe klant krijgt 10% korting op de eerste maand | 5% van wat klant 1–5 betaalt, 10% vanaf klant 6, zolang ze klant blijven |
| Wachttijd | 30 dagen na de eerste betaling | 60 dagen na elke betaling |
| Uitbetaling | Automatisch als Stripe-saldo, verrekend met de volgende factuur | Maandelijks per bankoverschrijving vanaf €50 (handmatig, zie hieronder) |

## Hoe het loopt

1. `/r/<code>` zet cookie `sf_ref` op `.sequenceflow.io` (60 dagen, laatste klik telt) en stuurt door naar de site.
2. Bij de eerste login maakt `auth/callback` de workspace en koppelt die aan de doorverwijzer of affiliate (`tenants.referred_by_tenant_id` / `tenants.affiliate_id`). Zichzelf doorverwijzen telt niet.
3. De eerste checkout van een doorverwezen klant zet 10% van het gekozen plan als tegoed op hun Stripe-saldo.
4. Stripe-webhook `invoice.paid` boekt een regel in `referral_rewards` (bedrag excl. btw, alleen wat echt betaald is). `charge.refunded` en `charge.dispute.created` zetten regels die nog niet zijn uitbetaald op `reversed`.
5. Cron `/api/cron/referrals` (dagelijks 05:00) zet regels na de wachttijd op `available` en zet tegoed voor doorverwijzers op hun Stripe-saldo, berekend over hun plan op dat moment (proef, verlopen of Shopify: blijft staan).

Workspaces die via Shopify App Pricing betalen tellen nog niet mee: daar komt geen Stripe-factuur binnen.

## Setup

- Migratie 059 uitvoeren.
- In Stripe → Webhooks de events `charge.refunded` en `charge.dispute.created` aan het bestaande endpoint toevoegen (naast `invoice.paid`).
- Leaderboard: toont testcijfers (beta) tot `AFFILIATE_LEADERBOARD_LIVE=true` in Vercel staat.

## Affiliates uitbetalen (maandelijks)

```sql
select * from affiliate_balances where available_cents >= 5000;
```

Maak per affiliate de self-billingfactuur (met btw als `vat_number` gevuld is), maak het bedrag over en zet de regels op betaald:

```sql
update referral_rewards set status = 'paid', settled_at = now(), settlement_ref = '<betalingskenmerk>'
where affiliate_id = '<id>' and kind = 'affiliate_commission' and status = 'available';
```

Particulieren (geen KvK): uitbetalingen moeten mogelijk worden gemeld aan de Belastingdienst (renseigneringsverplichting); laat de boekhouder dit bevestigen.
