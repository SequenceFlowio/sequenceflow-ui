# Kosten en winst, Otis op het overzicht, kennismaking met Seffy (16 nov 2026)

Branch `feat/kosten-otis-overzicht`.

## Backoffice: Kosten en winst (`?tab=kosten`)
- Elke AI-aanroep staat al in `ai_usage_events` (model + tokens). Het tabblad rekent die om met de
  OpenAI-tarieven uit `lib/internal/costs.ts` (dollar → euro tegen `USD_TO_EUR`).
- Per maand (6 maanden): omzet (betaalde Stripe-facturen) − OpenAI − Stripe-kosten − vaste kosten − Meta-advertenties = winst.
- Laatste 30 dagen: kosten per dag, per onderdeel (Seffy-concept, poortwachter, Otis, ...), per model, per klant (naast wat die betaalt).
- Meta: zodra `META_ADS_ACCESS_TOKEN` en `META_AD_ACCOUNT_ID` in Vercel staan, komen de uitgaven per maand mee
  (`loadMetaSpendByMonth`). Tot die tijd staat er "niet gekoppeld", niet €0.
- Terugstort-boekingen (`original_usage_event_id` gevuld, nul tokens) tellen niet als aanroep.
- Rekenwerk in `lib/backoffice/costs.ts` (getest in `tests/backoffice-costs.test.ts`), ophalen in `lib/backoffice/costsData.ts` (10 min cache, "Verversen" haalt vers op).
- Nog niet in de omzet: Shopify-facturering. Vaste kosten zijn een schatting (`FIXED_MONTHLY_EUR`).

## App: Otis op het Overzicht
- `app/(app)/dashboard/OtisPanel.tsx`, onder Seffy's cijfers: Otis' zin, uitverkocht / bijna op / bij te bestellen / ligt stil, en de drie belangrijkste acties.
- Zonder Scale: dezelfde blokken met demogegevens, grijs en op slot, met "Upgrade naar Scale".
- De voorraadpagina (Otis in het zijmenu) had dit al: demo + slot + upgrade. Ongewijzigd.
- Bekijken zonder login: `/design/overzicht` (op slot) en `/design/overzicht?scale=1`.

## App: kennismaking met Seffy
- Zelfde vorm en stijl als Otis (`OtisOnboarding`): intro, toon + je/u (met voorbeeldzin), afzender + taal + handtekening,
  korting ja/nee met maximum, kennis + "leer van mijn verzonden mail" (alleen met actieve IMAP). Daarna: kennis toevoegen of Seffy in de chat.
- Verschijnt bovenaan de inbox (Seffy in het zijmenu), alleen voor een beheerder, bij het eerste bezoek.
- Antwoorden gaan via de bestaande `POST /api/agent-config`; de datum via `PATCH /api/agent-config/onboarding`.
- Opnieuw doen: Instellingen → Antwoordstijl → "Kennismaking opnieuw doen".
- **Migratie `075_seffy_onboarding.sql` is nog niet op productie uitgevoerd.** Zonder die migratie verschijnt de
  kennismaking niet (niets breekt). De migratie zet bestaande werkruimtes met een handtekening meteen op "gedaan".
- Bekijken zonder login: `/design/seffy`.

## Otis-mail "Levering te laat"
- De mail klopte met de data (verwachte levering ingevoerd, voorraad niet gestegen). De datum staat nu als "13 november" in plaats van "2026-11-13".
