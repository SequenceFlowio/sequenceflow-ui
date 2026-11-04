# Support One: technische review, plan van aanpak en marketingplan

Opgesteld 2 november 2026 door Claude (Fable) na een volledige doorlichting van `sequenceflow-ui` (branch `main`, commit `ce3309a`). De andere repo (`Sequence-Flow`, de oude marketingsite) is buiten beschouwing gelaten; die staat al op de lijst om te archiveren (`docs/plan-na-goedkeuring.md` §D).

**Hoe dit document bedoeld is.** Het denkwerk staat hier. De werkpakketten in deel 4 zijn zo geschreven dat een kleiner model (Sonnet, Haiku) of een mens ze één voor één kan oppakken zonder de hele codebase opnieuw te lezen: per pakket staan de bestanden, de stappen, wat "klaar" betekent en hoe je het test. Werk volgens `AGENTS.md`: één bouwer per branch, Claude op `feat/*`, Codex op `codex/*`. Zet bij een pakket "Bezig: Claude/Codex (`branch`)" voordat je begint.

---

## Deel 1. Oordeel in het kort

Support One is een serieuze, goed doordachte codebase: ~55.000 regels TypeScript, 59 migraties, 56 testbestanden. De gevoelige paden zijn met zorg gebouwd:

- Alle webhooks (Stripe, Resend, Shopify, WooCommerce, bol.com) verifiëren handtekeningen en weigeren zonder secret (fail-closed).
- Commerce-acties (annuleren) zijn idempotent, hebben een audit-trail, preflight tegen de live orderstatus, een bedraglimiet per winkel en verplichte menselijke goedkeuring. Dit is beter dan de meeste concurrenten.
- MCP-server met OAuth 2.1 + PKCE, tokens alleen als hash opgeslagen, refresh-token-rotatie in één statement.
- Shopify-sessietokens worden volledig gevalideerd (HMAC, aud, exp, nbf, iss/dest), met online-token-hercontrole op staff-rechten.
- Credentials versleuteld met AES-256-GCM, aparte sleutels voor mail en commerce.
- RLS op alle tabellen (inclusief de inventory-tabellen via een dynamische loop in migratie 057).
- De AI-pipeline behandelt klantmail als onbetrouwbare data, blokkeert concepten die een orderstatus beweren die niet in de live context staat, en zet alles met een `cancel_order`-actie op menselijke review.

Wat ontbreekt of niet klopt, valt in drie groepen:

1. **Operationele hygiëne** (geen CI, geen rate limiting, verouderde dependencies, secrets in logs/querystrings, geen monitoring). Dit is het goedkoopst te verhelpen en het meest waarschijnlijk om ooit pijn te doen.
2. **Een paar echte bugs/randgevallen** (gebruiker in twee workspaces, Stripe-webhook zonder idempotentie, IMAP-cron zonder lock).
3. **Productkansen** die direct uit de roadmap en de code volgen en die de marketing nodig heeft (ROI-dashboard, wekelijkse briefing, proactieve vertragingsmail).

Niets wat ik vond is een "stop alles"-lek. De hoogste prioriteit is **WP-01** (Supabase-key uit de repo) en **WP-02** (Next.js critical CVE, proxy-bypass).

---

## Deel 2. Bevindingen: security

Prioriteit: **P0** = deze week, **P1** = deze maand, **P2** = als het uitkomt.

### S-01 (P0) Supabase anon-key en projectref in een n8n-export in de repo

- **Waar:** `SupportFlow OS V2 W Auth.json` (root), regel ~376: `"apikey": "eyJhbGciOi…"`. Payload: `{"ref":"tbxlejlkszorpxqzebqb","role":"anon"}`.
- **Risico:** een anon-key is op zichzelf publiek bedoeld, maar in combinatie met de projectref kan iedereen met repo-toegang rechtstreeks PostgREST-aanroepen doen. Als dit het productieproject is, leunt alles op RLS. Daarnaast staat het bestand sinds 14 okt in de git-geschiedenis.
- **Fix:** bestand verwijderen uit de repo (het is een oud n8n-workflow; Support One gebruikt n8n niet meer) en `*.n8n.json` / `SupportFlow*` in `.gitignore`. **Roteren is niet nodig:** de anon-key is bewust publiek (hij zit in de browser-bundel van elke bezoeker) en RLS staat op alle tabellen. Alleen een gelekte *service-role*-key zou rotatie vereisen; die is nergens in de repo of geschiedenis gevonden.
- **Zie:** WP-01.

### S-02 (P0) Next.js critical: proxy/middleware-bypass en DoS via Server Actions

- **Waar:** `package.json` → `next@^16.2.9`; `npm audit` meldt critical voor 9.3.4-canary.0 t/m 16.4.0 ("Middleware / Proxy bypass in App Router applications using Turbopack and single locale", "DoS in App Router using Server Actions").
- **Risico:** `proxy.ts` is de enige laag die "ben je ingelogd" afdwingt voor de app-pagina's. Een bypass daarop zou niet direct data lekken (de API-routes doen hun eigen `getTenantId`), maar de server-components onder `app/(app)/` lezen wel met de admin-client. De layout controleert zelf opnieuw de sessie, wat het risico beperkt, maar niet elke pagina.
- **Fix:** upgrade naar de eerste gepatchte 16.x (controleer `npm audit` na `npm update next eslint-config-next`), draai `npm run check`, test `/inbox` zonder cookie → redirect naar `/login`.
- **Zie:** WP-02.

### S-03 (P1) Cron-secret via query-string

- **Waar:** `app/api/cron/process-emails/route.ts`, `app/api/cron/autosend/route.ts`, `app/api/cron/backup-db/route.ts`: `new URL(req.url).searchParams.get("secret")`.
- **Risico:** het secret komt in Vercel-request-logs, proxy-logs en eventuele error-trackers terecht. Vercel Cron stuurt het secret altijd als `Authorization: Bearer`, dus de query-variant is niet nodig.
- **Fix:** query-param verwijderen; één gedeelde helper `requireCronSecret(req)` in `lib/auth/cron.ts` met `crypto.timingSafeEqual` (nu vergelijken `tick`, `backup-db`, `referrals`, `commerce-action-worker` met `===`), en alle 15 cron-routes daarop laten leunen.
- **Zie:** WP-03.

### S-04 (P1) Geen rate limiting op publieke, dure of gevoelige endpoints

- **Waar:**
  - `app/api/marketing/chat/route.ts`: in-memory limiter (40/uur per IP) die per serverless-instance leeft en dus feitelijk niet werkt op Vercel. Elke aanroep kost een OpenAI-call.
  - `app/api/affiliate/signup/route.ts`: alleen een honeypot. Iemand kan honderden affiliates per minuut aanmaken en per aanmelding een mail laten versturen via Resend (kosten + reputatie van `mail.sequenceflow.io`).
  - `app/api/contentcalender/access/login/route.ts`: gedeelde toegangscode, onbeperkt proberen.
  - `app/api/mcp/oauth/register/route.ts`: onbeperkt dynamische client-registratie → tabel `mcp_oauth_clients` volspammen.
  - `app/api/mcp/oauth/token/route.ts`: brute force op auth-codes is door 256 bits entropie niet realistisch, maar DB-load wel.
  - `/login` zelf leunt op Supabase Auth (die heeft eigen limieten; oké).
- **Fix:** één `lib/security/rateLimit.ts` op basis van een Postgres-tabel `rate_limit_buckets(key text pk, count int, window_start timestamptz)` met een `rpc('rate_limit_hit', key, limit, window_seconds)` die atomair ophoogt (geen Redis nodig; Supabase is er al). Toepassen op de vijf routes hierboven. Daarnaast een dagelijks kostenplafond voor `marketing/chat` (bijvoorbeeld 2.000 calls/dag, daarna de FALLBACK-tekst).
- **Zie:** WP-04.

### S-05 (P1) Stripe-webhook zonder idempotentie en met zwakke plan-validatie

- **Waar:** `app/api/billing/webhook/route.ts`.
- **Problemen:**
  1. Geen controle op `event.id`: Stripe levert events soms dubbel; `invoice.paid` reset dan twee keer `billing_period_start` en `recordInvoiceRewards` wordt twee keer aangeroepen (die is wel idempotent per factuur, dus geen dubbele commissie, maar het blijft kwetsbaar).
  2. `checkout.session.completed` schrijft `session.metadata.plan` ongecontroleerd in `tenants.plan`. De metadata komt uit onze eigen checkout-route, dus geen direct lek, maar valideer tegen `["starter","pro","agency"]`.
  3. `billing_period_start` wordt bij elke `customer.subscription.updated` op de 1e van de huidige maand gezet, ook bij een adreswijziging in Stripe. Daardoor kan de maandteller van antwoordconcepten tussentijds resetten (klant krijgt gratis extra concepten) of juist niet kloppen met de echte factuurperiode. Gebruik `current_period_start` van de subscription.
  4. `invoice.paid` leest `lines[0].price.id`: bij een factuur met proration-regels kan dat de verkeerde prijs zijn. Lees de prijs uit de subscription-regel (`lines.data.find(l => l.subscription)`) of haal de subscription op.
- **Fix:** tabel `stripe_webhook_events(event_id text pk, received_at)`, insert-first met `ignoreDuplicates`; plan-whitelist; periode uit subscription.
- **Zie:** WP-05.

### S-06 (P1) Nightly backup dumpt alles (inclusief versleutelde credentials en auth-users) in dezelfde Supabase-opslag

- **Waar:** `app/api/cron/backup-db/route.ts`.
- **Observatie:** de aanpak is verdedigbaar voor het Free-tier (de code zegt dat zelf). Maar: (a) de dump bevat `auth_users` met e-mailadressen en metadata, alle klantmails (`support_messages.body_original`) en versleutelde mailwachtwoorden; (b) het staat in hetzelfde project, dus bij projectverlies ben je alles kwijt; (c) de functie loopt alle tabellen sequentieel door binnen `maxDuration = 120` en zal bij groei time-outen zonder dat iemand het merkt (er is geen alert).
- **Fix (minimaal):** een mislukte backup e-mailen naar `SEQUENCEFLOW_OPS_EMAIL`; tabellen met klantinhoud (`support_messages`, `knowledge_chunks`) alleen meenemen als er ruimte is of los per run; retentie van 14 dagen is prima. **Fix (beter):** kopie naar een externe bucket (Cloudflare R2 of Backblaze B2 is vrijwel gratis) met een eigen service-key, zodat de backup losstaat van het Supabase-project.
- **Zie:** WP-06.

### S-07 (P2) Logging van identiteit en tenant-context op elke request

- **Waar:** `lib/tenant.ts` regels 63, 97, 117: `console.log("[tenant] TenantContext:", ctx)` bij elke API-aanroep.
- **Risico:** ruis in logs, gebruikers-ID's in Vercel-logs, en het maakt echte fouten moeilijker te vinden. Geen lek van gevoelige data, wel onnodig.
- **Fix:** verwijderen of achter `process.env.DEBUG_AUTH === "1"` zetten.
- **Zie:** WP-03 (meenemen).

### S-08 (P2) `hasValidInternalSecret` valt terug op `CRON_SECRET`

- **Waar:** `lib/auth/authorization.ts`. README noemt het "temporary compatibility fallback".
- **Fix:** controleer in Vercel dat `INTERNAL_API_SECRET` gezet is en verwijder de fallback. Daarna is een gelekt cron-secret niet ook een sleutel voor interne AI-routes.
- **Zie:** WP-03.

### S-09 (P2) Content Calendar: gedeelde toegangscode zonder gebruikersbinding

- **Waar:** `lib/contentCalendar/access.ts`, `app/api/contentcalender/access/login/route.ts`.
- **Observatie:** intern tooltje, code wordt timing-safe vergeleken, sessie-cookie is HMAC-getekend. Goed genoeg voor intern gebruik, maar (a) geen rate limiting (zie S-04), (b) de code kan niet per persoon worden ingetrokken, (c) `/api/contentcalender/import/media` accepteert elke bestandsgrootte en schrijft naar storage.
- **Fix:** rate limit (WP-04); overweeg later de tool achter de normale Supabase-login met `isTeamWhitelistedEmail` te zetten, dan vervalt de aparte code.

### S-10 (P2) Blog rendert markdown-HTML zonder sanitizer

- **Waar:** `app/blog/[slug]/page.tsx`: `dangerouslySetInnerHTML={{ __html: post.html }}`, gegenereerd door `marked`.
- **Risico:** laag, want de bron is eigen markdown in de repo (`content/`). Wordt dat ooit een CMS of door externen geschreven, dan is dit XSS.
- **Fix:** `marked` + een allowlist-sanitizer (bijvoorbeeld `sanitize-html` of de `marked`-optie met `DOMPurify` server-side via `isomorphic-dompurify`), of de HTML bij build-time genereren. P2.

### S-11 (informatief) Dingen die goed zijn en zo moeten blijven

Voor wie later aan deze code werkt: verander dit niet zonder reden.

- `proxy.ts` controleert alleen "ingelogd"; workspace- en plancontrole zit in `app/(app)/layout.tsx`. Bewust, om twee DB-queries per paginaweergave te sparen.
- `readSessionClaims` valideert de JWT lokaal (publieke sleutel); een verwijderde gebruiker houdt maximaal een uur toegang. Geaccepteerd risico; staat gedocumenteerd.
- Commerce: `createCancellationProposal` eist expliciete annuleringsintentie in de klanttekst (`hasExplicitCancellationIntent`), `actionMode === "approval_required"`, en de `support_decisions`-rij krijgt `blocking_action_id` zodat het concept pas verstuurd kan worden als de annulering geslaagd én bevestigd is (`blockingActionAllowsReply`).
- `unverifiedCommerceClaims` gooit een concept weg dat "verzonden/terugbetaald/geannuleerd" beweert zonder dat de live context dat zegt. Dit is de belangrijkste anti-hallucinatiemaatregel; houd hem.
- Shopify-webhooks worden eerst versleuteld opgeslagen en pas door de worker verwerkt ("durable receipt precedes acknowledgment").

---

## Deel 3. Bevindingen: correctheid en robuustheid

### C-01 (P1) Eén gebruiker kan maar in één workspace zitten, maar de code laat meer toe

- **Waar:** `lib/tenant.ts:102-110` (`.single()` op `tenant_members` per `user_id`), `app/(app)/layout.tsx:52-56` (idem), `lib/tenant/resolveTenant.ts` (`.maybeSingle()`), `app/auth/callback/route.ts`.
- **Probleem:** migratie 006 heeft `unique (tenant_id, user_id)`, niet `unique (user_id)`. Via `app/api/team/invite/route.ts` kan een admin iemand uitnodigen die al een eigen workspace heeft. Daarna heeft die gebruiker twee rijen en gooit `.single()` een fout → "Tenant not found for user" op elke API-aanroep, en de layout stuurt naar `/login?error=tenant`. De gebruiker zit buitengesloten uit **beide** workspaces.
- **Keuze:** óf (A) één workspace per gebruiker afdwingen: unieke index op `tenant_members(user_id)`, en in `team/invite` eerst controleren of het e-mailadres al een membership heeft (nette foutmelding: "Dit adres heeft al een eigen workspace; laat ze eerst die opzeggen of gebruik een ander adres"); óf (B) echte multi-workspace met een workspace-switcher (cookie `sf_tenant`). (A) is een middag werk en past bij het product nu; (B) is een week en pas nodig voor agencies.
- **Aanbeveling:** A nu, B als een agency-klant erom vraagt.
- **Zie:** WP-07.

### C-02 (P1) IMAP-sync draait elke minuut zonder lock, met een budget van 60 seconden

- **Waar:** `vercel.json` (`* * * * *`), `app/api/cron/process-emails/route.ts` (`maxDuration = 60`), `lib/email/inbound/syncImapMailbox.ts` (geen lease/claim gevonden).
- **Probleem:** als een run 60 s duurt (trage IMAP-server, 20 mails met AI-verwerking), start de volgende run terwijl de vorige nog bezig is. Dezelfde mail kan dan twee keer door de pipeline en twee concepten (en twee keer AI-kosten) opleveren, tenzij `support_messages.provider_message_id` een unieke index heeft en de insert faalt. Controleer dat; zo niet, dan is dat de eerste fix.
- **Fix:** per mailbox een lease in `tenant_email_channels` (`sync_lease_until timestamptz`): claim met `update … where sync_lease_until < now() returning id`, zet op `now() + 90s`, geef vrij aan het einde. Plus een unieke index op `(tenant_id, provider_message_id)` als die ontbreekt.
- **Zie:** WP-08.

### C-03 (P1) Geen CI: `npm run check` draait alleen als iemand eraan denkt

- **Waar:** geen `.github/workflows/`.
- **Probleem:** een push naar `main` gaat live via Vercel. Vercel bouwt wel, maar draait geen `eslint` of `node --test`. 56 testbestanden die niet automatisch draaien, zijn tests die langzaam verouderen.
- **Fix:** `.github/workflows/check.yml` met `npm ci && npm run check && npm audit --omit=dev --audit-level=high` op elke PR en push naar `main`. Zet in GitHub branch protection op `main` dat de check groen moet zijn.
- **Zie:** WP-09.

### C-04 (P1) 13 kwetsbare dependencies (1 critical, 10 high)

Uit `npm audit --omit=dev` (2 nov 2026):

| Pakket | Ernst | Relevantie voor ons |
|---|---|---|
| `next` | critical | zie S-02 |
| `nodemailer` ≤10.1.3 | high | wij versturen via SMTP met klantwachtwoorden; IDN-allowlist-bypass is voor ons niet direct uitbuitbaar, maar upgrade |
| `mailparser` / `html-to-text` / `deepmerge-ts` | high | wij parsen inkomende mail van onbekenden → stack-exhaustion DoS op de IMAP-worker is realistisch |
| `imapflow` | moderate | via nodemailer |
| `sharp` (libvips/libheif CVE's) | high | wij verwerken afbeeldingen van derden (bijlagen, Content Calendar) → upgrade |
| `postcss`, `source-map-js`, `baseline-browser-mapping`, `nanoid`, `zod`, `ip-address` | high/moderate | build-time of transitief; laag risico, wel meenemen |
| `pdf-parse@1.1.1` | – | niet in audit, maar sinds 2019 niet onderhouden; wij voeren PDF's van klanten in. Overweeg `pdfjs-dist` direct (de code gebruikt die intern al als fallback) of `unpdf`. |

- **Zie:** WP-02.

### C-05 (P2) `tenant/resolveTenant.ts` en `auth/callback` maken allebei tenants aan, op verschillende manieren

- `resolveTenant` zet `plan: "trial", trial_ends_at: +14d`; `auth/callback` zet alleen `name` en vertrouwt op DB-defaults, en maakt wél `tenant_agent_config` aan. Als `resolveTenant` nog ergens wordt aangeroepen (controleer met grep), ontstaan tenants zonder agent-config. Eén `lib/tenant/provision.ts` met één `provisionTenant(user)` lost dit op.
- **Zie:** WP-07 (meenemen).

### C-06 (P2) Billing-periode: `getTenantPlan` telt usage over de hele geschiedenis per aanroep

- `countTenantAnswerUnits` pagineert alle `support_decisions` sinds `billingPeriodStart` en telt in JS. Bij 1.500 concepten/maand is dat 2 queries; prima. Bij een Scale-klant met jaren historie en elke paginaweergave die `getTenantPlan` aanroept, wordt het traag. Een dagelijkse materialized count (`tenant_usage_daily`) via `operations-rollup` is de nette oplossing; niet urgent.

### C-07 (P2) `autosend`-cron vuurt alleen in een venster van 10–14 minuten ná de ingestelde tijd

- `isWithinWindow`: `diff >= 10 && diff <= 14`. De cron draait elke 5 minuten, dus dit venster wordt altijd één keer geraakt; als Vercel een run overslaat (gebeurt), gaat de mail die dag niet. Oplossing: in plaats van een venster een `last_autosend_run_at` per tenant bijhouden en versturen als `now >= slot && last_run < slot`. Klein werk, voorkomt "mijn mails gingen niet" tickets.

### C-08 (P2) Lege `catch {}` op cookie-set in `lib/tenant.ts` en `auth/callback`

Bewust (route handlers mogen soms geen cookies zetten), maar log het eenmalig met `console.warn` zodat een sessie-refresh die stilletjes faalt zichtbaar wordt.

### C-09 (informatief) Geen error-tracking of uptime-monitoring

Geen Sentry/Axiom/PostHog gevonden. Alles gaat naar `console.error` in Vercel-logs die na een paar dagen weg zijn. Met één afhankelijkheid (`@sentry/nextjs`, gratis tier) worden fouten in crons en webhooks zichtbaar zonder dat een klant het hoeft te melden. Plus een externe uptime-check op `/api/integrations/status` (bijvoorbeeld Better Stack of UptimeRobot, gratis). **Zie:** WP-10.

---

## Deel 4. Werkpakketten (uitvoerbaar door een kleiner model)

Elk pakket: één branch, één PR, `npm run check` groen, en een korte notitie in de PR-beschrijving wat getest is. Volgorde is de aanbevolen volgorde.

### WP-01 (P0, 1 uur) Supabase-key uit de repo

**Klaar: Claude, 3 nov (commit 5e241a7). `tbxlejlkszorpxqzebqb` is het productieproject (staat ook in `.mcp.json`); rotatie van de anon-key is niet nodig, zie S-01.**

**Branch:** `feat/remove-n8n-export`
**Bestanden:** `SupportFlow OS V2 W Auth.json`, `.gitignore`
**Stappen:**
1. `git rm "SupportFlow OS V2 W Auth.json"`.
2. Voeg aan `.gitignore` toe: `*.n8n.json` en `SupportFlow*`.
3. Zoek in de hele repo naar `tbxlejlkszorpxqzebqb` en naar `eyJhbGciOi` (behalve in tests/fixtures). Alles wat je vindt, verwijderen.
4. Geen rotatie nodig (zie S-01); geschiedenis herschrijven ook niet.
**Klaar als:** het bestand weg is en `grep -r eyJhbGciOi . --exclude-dir=node_modules` niets oplevert (de projectref zelf in `.mcp.json` is geen geheim).

### WP-02 (P0, halve dag) Dependencies bijwerken

**Klaar: Claude, 3 nov. `npm audit --omit=dev`: 0 kwetsbaarheden (next 16.4.4, nodemailer 10.3.1, mailparser 3.14.1, sharp 0.35.5). Nieuwe React-Compiler-lintregels staan op `warn` (56 waarschuwingen in bestaande componenten, zie WP-11). `pdf-parse` is nog niet vervangen; dat staat open.**

**Branch:** `feat/deps-nov-2026`
**Bestanden:** `package.json`, `package-lock.json`, mogelijk `lib/ingest/processDocument.ts`
**Stappen:**
1. `npm update next eslint-config-next nodemailer mailparser imapflow sharp` en controleer `npm audit --omit=dev`.
2. Voor pakketten die alleen via een major-bump gefixt zijn: `npm install <pkg>@latest` één voor één, telkens `npm run check`.
3. `pdf-parse`: vervang door `unpdf` (ESM, onderhouden, werkt serverless) of gebruik `pdfjs-dist` direct. De bestaande fallback-logica in `extractPdfText` (drie pogingen met verschillende pdf.js-versies) kan dan terug naar één poging met `ignoreErrors`. Test met: een normale PDF, een PDF met kapotte xref (er ligt er waarschijnlijk een in de testdata van een klant; anders maak er een met `qpdf --qdf` en knip de xref), en een PDF zonder tekstlaag (moet nette fout geven).
4. Test handmatig na de Next-upgrade: inloggen, `/inbox` zonder cookie → redirect, `/shopify?shop=x.myshopify.com` krijgt de juiste CSP-header, `/oauth/authorize` laadt.
**Klaar als:** `npm audit --omit=dev` geen critical/high meer meldt (of elke resterende high heeft een regel uitleg in de PR waarom hij niet relevant is), `npm run check` groen.

### WP-03 (P1, halve dag) Cron- en interne secrets opschonen

**Klaar: Claude, 3 nov (5e241a7). Open voor Navaron: controleren dat `INTERNAL_API_SECRET` in Vercel Production staat; de fallback op `CRON_SECRET` is weg.**

**Branch:** `feat/cron-auth-helper`
**Bestanden:** nieuw `lib/auth/cron.ts`; alle `app/api/cron/*/route.ts`, `app/api/contentcalender/cron/route.ts`, `app/api/knowledge/worker/route.ts`; `lib/auth/authorization.ts`; `lib/tenant.ts`
**Stappen:**
1. Maak `lib/auth/cron.ts`:
   ```ts
   import crypto from "node:crypto";
   export function hasValidCronSecret(req: Request, secret = process.env.CRON_SECRET) {
     const header = req.headers.get("authorization") ?? "";
     const supplied = header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "";
     if (!secret || !supplied) return false;
     const a = Buffer.from(secret), b = Buffer.from(supplied);
     return a.length === b.length && crypto.timingSafeEqual(a, b);
   }
   export function unauthorizedCron() { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
   ```
2. Vervang in elke cron-route de eigen `authenticate`/`authorized`-functie door deze helper. Verwijder overal `searchParams.get("secret")`.
3. `lib/auth/authorization.ts`: verwijder de fallback `?? process.env.CRON_SECRET` in `hasValidInternalSecret`. **Vooraf controleren** dat `INTERNAL_API_SECRET` in Vercel Production staat (Navaron).
4. `lib/tenant.ts`: verwijder de drie `console.log`-regels (63, 97, 117).
5. Test: `tests/cron-schedule.test.ts` bestaat al; voeg `tests/cron-auth.test.ts` toe met: goed Bearer → true, goed `x-cron-secret` → true, query-param → false, lengteverschil → false, geen env → false.
**Klaar als:** `grep -rn 'searchParams.get("secret")' app` leeg is, alle cron-routes de helper gebruiken, tests groen.

### WP-04 (P1, 1 dag) Rate limiting op publieke endpoints

**Klaar: Claude, 3 nov. Migratie 061 moet op productie worden uitgevoerd; tot die tijd staat de limiter fail-open (logt een fout, laat door).**

**Branch:** `feat/rate-limits`
**Bestanden:** nieuw `supabase/migrations/060_rate_limits.sql`, nieuw `lib/security/rateLimit.ts`, `app/api/marketing/chat/route.ts`, `app/api/affiliate/signup/route.ts`, `app/api/contentcalender/access/login/route.ts`, `app/api/mcp/oauth/register/route.ts`, `app/api/mcp/oauth/token/route.ts`, `app/api/marketing/meeting/route.ts`, `app/api/marketing/chat/escalate/route.ts`
**Stappen:**
1. Migratie 060:
   ```sql
   create table rate_limit_buckets (
     key text primary key,
     count integer not null default 0,
     window_start timestamptz not null default now()
   );
   alter table rate_limit_buckets enable row level security;
   revoke all on rate_limit_buckets from anon, authenticated;
   create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
   returns boolean language plpgsql security definer as $$
   declare v_count int;
   begin
     insert into rate_limit_buckets(key, count, window_start) values (p_key, 1, now())
     on conflict (key) do update set
       count = case when rate_limit_buckets.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rate_limit_buckets.count + 1 end,
       window_start = case when rate_limit_buckets.window_start < now() - make_interval(secs => p_window_seconds) then now() else rate_limit_buckets.window_start end
     returning count into v_count;
     return v_count <= p_limit;
   end $$;
   ```
   Plus een opruimregel in `cleanup-old-email`: `delete from rate_limit_buckets where window_start < now() - interval '1 day'`.
2. `lib/security/rateLimit.ts`: `export async function allow(scope: string, id: string, limit: number, windowSeconds: number): Promise<boolean>` die `rpc("rate_limit_hit", …)` aanroept met key `${scope}:${id}`; bij een DB-fout `true` teruggeven en `console.error` (fail-open voor beschikbaarheid, maar log het).
3. Helper voor het IP: `clientIp(req)` = eerste waarde van `x-forwarded-for`, anders `"unknown"`.
4. Limieten: `marketing/chat` 30/uur per IP én 2.000/dag globaal (key `marketing-chat:global:YYYY-MM-DD`); `affiliate/signup` 5/uur per IP en 3/dag per e-mailadres; `contentcalender/login` 10/15 min per IP; `mcp/oauth/register` 20/uur per IP; `mcp/oauth/token` 60/min per IP; `marketing/meeting` en `chat/escalate` 10/uur per IP.
5. Antwoord bij overschrijding: 429 met een nette Nederlandse tekst (die staat voor chat al in de route).
6. Verwijder de in-memory `recent`-Map uit `marketing/chat`.
7. Test: `tests/rate-limit.test.ts` met een mock van `rpc`.
**Klaar als:** de zeven routes de helper gebruiken, migratie 060 gedocumenteerd in README (`door 060`), tests groen.

### WP-05 (P1, halve dag) Stripe-webhook idempotent en correct

**Klaar: Claude, 3 nov (6600e1d). Migratie 060 op productie uitvoeren.**

**Branch:** `feat/stripe-webhook-idempotency`
**Bestanden:** nieuw `supabase/migrations/061_stripe_webhook_events.sql`, `app/api/billing/webhook/route.ts`
**Stappen:**
1. Migratie: `create table stripe_webhook_events (event_id text primary key, type text not null, received_at timestamptz not null default now()); alter table … enable row level security; revoke all … from anon, authenticated;` Opruimen na 30 dagen in `cleanup-old-email`.
2. Direct na `constructEvent`: `insert … { event_id: event.id, type: event.type }` met `ignoreDuplicates: true` en `.select("event_id")`. Als er niets terugkomt → `return NextResponse.json({ received: true, duplicate: true })`.
3. `checkout.session.completed`: `const ALLOWED = new Set(["starter","pro","agency"]); if (!ALLOWED.has(plan)) { console.error(...); break; }`.
4. `customer.subscription.updated`: gebruik `sub.current_period_start` (Unix-seconden; in Stripe API 2025+ staat dit op `sub.items.data[0].current_period_start`, controleer de versie in `stripe@20`) voor `billing_period_start` in plaats van de 1e van de maand.
5. `invoice.paid`: kies de regel met `line.parent?.subscription_item_details` (nieuwe API) of `line.subscription` (oude) in plaats van `lines[0]`.
6. Test: `tests/stripe-webhook.test.ts` die de handler-functies isoleert (haal de switch-body naar `lib/billing/stripeEvents.ts` zodat hij zonder HTTP te testen is) met: duplicaat event → geen tweede update; onbekend plan → geen update; proration-regel → juiste prijs.
**Klaar als:** twee keer hetzelfde event sturen met `stripe trigger invoice.paid` (Stripe CLI, testmodus) één update oplevert.

### WP-06 (P1, halve dag) Backup: alerts en externe kopie

**Branch:** `feat/backup-alerts`
**Bestanden:** `app/api/cron/backup-db/route.ts`, `lib/email/mailboxAlerts.ts` (hergebruik de bestaande ops-mail), `.env.example`
**Stappen:**
1. In de `catch` van `handler`: stuur een mail naar `SEQUENCEFLOW_OPS_EMAIL` via `sendEmail` uit `lib/resend.ts` met de foutmelding. Ook als de run langer dan 100 s duurde (waarschuwing: time-out nabij).
2. Optioneel maar aanbevolen: na de upload naar Supabase Storage ook een `PUT` naar een S3-compatibele bucket (Cloudflare R2) met `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_KEY`, `BACKUP_S3_SECRET`. Gebruik `@aws-sdk/client-s3` (R2 is S3-compatibel). Alleen uitvoeren als de variabelen gezet zijn.
3. Documenteer in README onder "Backups": waar ze staan, hoe je terugzet (de code heeft dat al in een comment; verplaats naar README).
**Klaar als:** een geforceerde fout (verkeerde `SUPABASE_URL` lokaal) een mail oplevert; met R2-variabelen verschijnt het bestand in R2.

### WP-07 (P1, halve dag) Eén workspace per gebruiker, netjes afgedwongen

**Klaar: Claude, 3 nov (6348c64). Migratie 063 op productie uitvoeren; vooraf de dubbele-lidmaatschappen-query draaien (staat in de migratie).**

**Branch:** `feat/one-workspace-per-user`
**Bestanden:** nieuw `supabase/migrations/062_one_membership_per_user.sql`, `app/api/team/invite/route.ts`, nieuw `lib/tenant/provision.ts`, `lib/tenant/resolveTenant.ts`, `app/auth/callback/route.ts`
**Stappen:**
1. **Vooraf (SQL in Supabase):** `select user_id, count(*) from tenant_members group by 1 having count(*) > 1;` Zijn er gebruikers met twee rijen, los die eerst handmatig op (meestal: de uitgenodigde rij verwijderen) en meld dat aan Navaron.
2. Migratie 062: `create unique index tenant_members_one_per_user on tenant_members(user_id);`
3. `team/invite`: vóór `inviteUserByEmail` zoeken of er al een auth-user met dit e-mailadres is (`supabase.auth.admin.listUsers` filtert niet op e-mail; gebruik `rpc` of een query op `auth.users` via een `security definer`-functie `find_user_id_by_email(text)`). Bestaat de gebruiker en heeft die al een `tenant_members`-rij → 409 met: "Dit e-mailadres heeft al een Support One-workspace. Vraag de persoon om die eerst op te zeggen, of nodig een ander adres uit."
4. `lib/tenant/provision.ts`: één `provisionTenant({ userId, name })` die tenant + `tenant_agent_config` + membership aanmaakt met `plan: "trial"` en `trial_ends_at: +14 dagen`. Laat `auth/callback` en `resolveTenant` die gebruiken. Controleer met grep of `resolveTenant` nog wordt aangeroepen; zo niet, verwijder het bestand.
5. Test: `tests/team-invite.test.ts` (geïsoleerde check-functie) en update van `tests/post-login-path.test.ts` als die provisioning raakt.
**Klaar als:** uitnodigen van een bestaand adres een 409 geeft met de tekst hierboven; nieuwe gebruiker krijgt tenant + agent-config + trial.

### WP-08 (P1, halve dag) IMAP-sync zonder dubbel werk

**Klaar: Claude, 3 nov (28472f6). Migratie 062 verwijdert dubbele inbound-rijen; eerst tellen met de query in de migratie en Navaron melden.**

**Branch:** `feat/imap-sync-lease`
**Bestanden:** nieuw `supabase/migrations/063_imap_sync_lease.sql`, `lib/email/inbound/syncImapMailbox.ts`
**Stappen:**
1. Controleer: `grep -n "provider_message_id" supabase/migrations/*.sql` → is er een unieke index op `support_messages(tenant_id, provider_message_id)`? Zo niet: toevoegen in migratie 063 (eerst duplicaten tellen met een `group by having count(*)>1`; als die er zijn, bewaar de oudste en verwijder de rest, of maak de index `where provider_message_id is not null`).
2. Migratie 063: `alter table tenant_email_channels add column sync_lease_until timestamptz;`
3. In `syncActiveImapMailboxes`: per mailbox eerst `update tenant_email_channels set sync_lease_until = now() + interval '90 seconds' where id = $1 and (sync_lease_until is null or sync_lease_until < now()) returning id`. Geen rij terug → `skipped: "leased"`. In `finally`: lease op `null`.
4. In `runInboundEmailPipeline`: vang een unique-violation (`23505`) op de insert van `support_messages` op en retourneer `status: "duplicate"` zonder AI-call.
5. Test: `tests/mailbox-source-safety.test.ts` bestaat; voeg een test toe voor de lease-logica (pure functie `shouldSkipLease(leaseUntil, now)`).
**Klaar als:** twee gelijktijdige aanroepen van `/api/cron/process-emails` (lokaal met `curl &` twee keer) de tweede als `leased` tonen en geen dubbele `support_messages`-rijen ontstaan.

### WP-09 (P1, 1 uur) CI met GitHub Actions

**Klaar: Claude, 3 nov (6600e1d). Nog te doen in GitHub: branch protection op `main` met verplichte check `check`.**

**Branch:** `feat/ci`
**Bestanden:** nieuw `.github/workflows/check.yml`
**Inhoud:**
```yaml
name: check
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder
      - run: npm audit --omit=dev --audit-level=high
        continue-on-error: true
```
Controleer welke env-variabelen `next build` echt nodig heeft (de build mag niet op ontbrekende secrets vallen; lees `lib/brand.ts` en `lib/site.ts`). Daarna in GitHub: Settings → Branches → `main` → require status check `check`.
**Klaar als:** een PR de check toont en rood wordt bij een bewust kapotte test.

### WP-10 (P2, halve dag) Foutbewaking en uptime

**Branch:** `feat/observability`
**Stappen:** `npx @sentry/wizard@latest -i nextjs` (gratis tier), `SENTRY_DSN` in Vercel; zet `beforeSend` zo dat `body_original`, e-mailadressen en Authorization-headers worden gestript (Sentry heeft `sendDefaultPii: false`, laat dat zo). Externe uptime-check op `GET /api/integrations/status` (geeft 200 bij gezonde Supabase) elke 5 minuten, alert naar `SEQUENCEFLOW_OPS_EMAIL`.
**Klaar als:** een bewuste `throw` in een cron-route in Sentry verschijnt zonder PII.

### WP-11 (P2, 2 uur) Kleine correctheidspunten

**Branch:** `feat/small-fixes-nov`
- C-07: autosend op `last_autosend_run_at` per tenant in plaats van het 10–14-minutenvenster (`tenant_agent_config.autosend_last_run_at`, migratie 064).
- C-08: `console.warn` in de lege cookie-catches.
- S-10: `marked` + sanitizer in `app/blog/[slug]/page.tsx` en `lib/marketing/blog.ts`.
- `app/api/feedback/route.ts`: `profiles … .single()` faalt als een tenant geen profiel heeft; gebruik `maybeSingle()`.

---

## Deel 5. Nieuwe functies: wat bouwen en waarom

De roadmap (`docs/roadmap.md`) is goed; ik verander de volgorde niet veel, maar ik geef per punt het "waarom" voor marketing en de kortste route in de code. Alles hieronder is al grotendeels in de data aanwezig; het gaat om zichtbaar maken.

### F-01 "Deze maand bespaard": het ROI-blok (roadmap #2) — **bouw dit eerst**

**Waarom:** dit is het enige dat een trial-klant omzet in een betalende klant, en het is de belangrijkste advertentie-angle (zie Deel 6). Nu ziet de klant "47 concepten"; dat is een kostenpost, geen opbrengst.
**Wat:** op `/dashboard` een kaart met vier getallen over de huidige maand:
- **Uren bespaard** = (aantal verstuurde concepten met `review_status in ('sent')` + autosend) × gemiddelde handmatige schrijftijd. Gebruik 6 minuten per mail als default, instelbaar in Instellingen ("Hoe lang doe je gemiddeld over een klantmail?"). Zeg erbij "op basis van jouw schatting van X min per mail": geen onbewezen claim (Brand DNA-guardrail).
- **Reactietijd**: mediaan van `support_messages.sent_at − received_at` voor beantwoorde gesprekken, naast de mediaan van vóór Support One (de eerste 30 dagen aan gemijnde mailbox-historie in `mining-worker` geven een baseline).
- **Omzet gered**: som van `commerce_orders.total_amount` van gesprekken met intent `cancellation` waarvan de klant daarna **niet** annuleerde (order niet `cancelledAt` binnen 14 dagen). Label het "annuleringsverzoeken waarbij de bestelling behouden bleef", niet "gered door AI".
- **Zelf afgehandeld**: percentage `autosend_sent` van alle verstuurde.
**Code:** `lib/analytics/core.ts` heeft de helpers; voeg `lib/analytics/roi.ts` toe met één `loadRoiSummary(tenantId, month)` en een route `app/api/analytics/roi/route.ts`. Component `components/dashboard/RoiCard.tsx`. Hergebruik in de wekelijkse mail (F-02) en in Sefi/MCP (`get_support_overview`).
**Marketing-koppeling:** screenshots van deze kaart (met demo-data) zijn de beste ad-creatives.

### F-02 Wekelijkse briefing per mail (roadmap #7) — **klein werk, grote retentie**

**Waarom:** een klant die elke maandag een mail krijgt met "3 problemen, €X op het spel, 2 acties", zegt niet op. De briefing bestaat al in `commerce_intelligence_briefings`.
**Wat:** cron `/api/cron/weekly-briefing` (maandag 06:00 UTC in `vercel.json`), per tenant met `briefing_email_enabled` (nieuwe kolom, default aan voor Growth+): laad de laatste briefing + F-01 ROI + top-3 intents, render een eenvoudige HTML-mail (hergebruik `lib/inventory/email.ts` als voorbeeld), verstuur via Resend met `List-Unsubscribe`-header en een uitschakellink (getekende token zoals `renderToken` in Content Calendar).
**Marketing-koppeling:** "Elke maandag weet je wat je klanten dwarszit, zonder je inbox te openen."

### F-03 Proactief melden van vertraagde zendingen (roadmap #4)

**Waarom:** dit is de functie die niemand anders in NL heeft voor kleine webshops, en hij voorkomt de duurste supportvraag ("waar blijft mijn pakket"). Trackingdata van bol.com (`lib/commerce/bol.ts`, `tracking/[shipmentId]`) en Shopify-fulfillments zijn er al.
**Wat, in stappen:**
1. `commerce_shipments` per dag vergelijken met verwachte leverdatum; markeer `delayed` als 2+ dagen over verwachting zonder `delivered`-event.
2. Per vertraging een **concept** (geen autosend in v1) in de inbox: "Je bestelling #1234 is vertraagd; verwachte nieuwe levering …". Intent `proactive_delay`. De winkel keurt goed zoals elk ander concept.
3. Pas na 4 weken en bewijs: optioneel automatisch versturen binnen de autosend-regels.
**Code:** nieuwe worker in `tick` (`delay-detector`), tabel `proactive_notices` (migratie), hergebruik `runInboundEmailPipeline` niet (er is geen inbound); maak een kleinere `createProactiveDraft` in `lib/pipeline/proactive.ts`.
**Marketing-koppeling:** "Support One mailt je klant vóórdat die 'waar blijft mijn pakket' typt."

### F-04 Meer acties met een limiet (roadmap #3): begin met **retourlabel** en **adreswijziging**, niet met terugbetalen

**Waarom:** terugbetaling is het engst voor de ondernemer en juridisch het meest gevoelig. Een retourlabel sturen of een adres wijzigen vóór verzending is laag risico, hoog volume, en bewijst dat "veilige acties met limiet" werkt. Daarna korting/tegoed tot €25, daarna refunds.
**Code:** het `commerce_action_proposals`-model is generiek genoeg (`action_type`, `parameters`, `policy_snapshot`). Voeg `action_type in ('update_shipping_address','send_return_label')` toe, een adapter-methode per provider (`shopifyOperations.ts` heeft al de mutatiestructuur), en breid `validateDecision` uit met de nieuwe types. Houd dezelfde flow: voorstel → goedkeuring → preflight → uitvoering → bevestigingsconcept.

### F-05 Voorraadsignalen op verkoopsnelheid + "weer op voorraad"-wachtlijst (roadmap #5, #6)

Zit al grotendeels in `feat/inkoopadvies` (`lib/inventory/*`, migratie 057). De marketingwaarde zit in **één zin op het dashboard**: "23 klanten vroegen naar maat M in groen; over 9 dagen op." Dat is `inventory_questions` + `daysOfStock`. De wachtlijst (klant automatisch mailen bij voorraad) is een logische vervolgstap met een nieuwe tabel `back_in_stock_requests(tenant_id, customer_email, variant_id, conversation_id)` gevuld vanuit intent `product_question` + variant-match.

### F-06 Kleinere, snelle winsten

- **Onboarding-checklist op het dashboard** (mailbox gekoppeld → kennis geüpload → eerste concept bekeken → eerste verzonden → autosend overwogen). De data is er; dit verhoogt trial-activatie meetbaar. 1 dag.
- **"Probeer een voorbeeld" vanaf de marketingsite** zonder account: er is al een sample-flow voor Shopify (`app/api/shopify/sample`). Een publieke variant met vaste demo-kennisbank en een limiet per IP (WP-04) is een sterke landingspagina-CTA: plak een klantmail, zie het concept. 1–2 dagen.
- **Outlook/Microsoft 365** (roadmap #1) is al bezig; dit verdubbelt de adresseerbare markt in NL (veel webshops op Microsoft 365 via hun hostingpakket).
- **Reviews beantwoorden** (roadmap later): bol.com en Google reviews als "inbound" door dezelfde pipeline halen is technisch klein (het is tekst in, concept uit) en commercieel groot voor de "één overzicht"-belofte. Zet dit eerder dan WhatsApp.

### F-07 Niet doen (nu)

- WhatsApp/Instagram-DM: groot project, andere verwachtingen (realtime), en de Meta-approval kost maanden. Pas na 50 betalende klanten.
- Anonieme benchmarks tussen winkels: AVG-check nodig en te weinig data.
- Multi-workspace (C-01 optie B): pas als een agency ernaar vraagt.

---

## Deel 6. Marketingplan

Uitgangspunten: de Brand DNA (`marketing/brand/BRAND_DNA.md`), de bestaande persona's en de €100/dag-strategie zijn goed en blijven de basis. Wat hieronder staat, vult aan en kiest scherper. De roadmap zegt zelf al wat het verhaal is ("Waar we ons op onderscheiden"): dat verhaal staat nog niet in de advertenties. De huidige ads (`C02_META_PROSPECTING.md`) gaan over "AI maakt concepten op basis van je beleid". Dat is waar, maar het is wat ChatGPT ook zegt. De nieuwe ads moeten gaan over wat ChatGPT **niet** doet.

### 6.1 Positionering in één zin

**"De AI-collega die in je supportmailbox werkt: leest, antwoordt, voert veilige acties uit en vertelt je elke week wat je klanten dwarszit. Jij houdt de controle."**

Tegenover:
- *ChatGPT/Claude/Sidekick*: schrijft een antwoord als jij het vraagt. Support One draait 24/7 op de mailbox zelf, met goedkeuring, acties en geheugen.
- *Gorgias/Zendesk/Trengo*: een nieuwe helpdesk waar je naartoe moet verhuizen en per seat betaalt. Support One werkt in je bestaande mailbox, vanaf €79.
- *Shopify Inbox*: alleen chat, alleen Shopify. Support One doet e-mail voor bol.com, Shopify en WooCommerce in één overzicht.

### 6.2 Doelgroep scherper kiezen voor de eerste 50 klanten

Kies **één** primaire persona voor de komende 90 dagen: **de oprichter van een Nederlandse webshop met 20–200 bestellingen per dag die zelf nog (deels) support doet**, en die verkoopt via bol.com én een eigen shop. Redenen:
1. bol.com-koppeling is uniek in de markt; niemand richt zich op deze groep.
2. Deze ondernemer voelt de pijn zelf (de persona-doc zegt het al: "guilt when replies wait").
3. Kort beslistraject, geen inkoopafdeling, betaalt met eigen kaart.

De supportteam-lead-persona blijft voor retargeting en SEO, maar niet voor koude prospecting in deze fase.

### 6.3 Kanalen en tactieken (in volgorde van verwachte kosten per activatie)

1. **bol.com-partnercommunity en -groepen.** Er zijn grote Facebook-groepen en fora voor bol.com-verkopers ("Bol.com Partners NL", Partnerplatform-topics). Niet adverteren: **waarde posten**. Eén post per week met een concreet inzicht uit geanonimiseerde data ("De 5 vragen die bol-klanten het vaakst stellen en hoe je ze voorkomt"). Gratis, hoge intentie. Doel: 10 trials in maand 1.
2. **Content Calendar-posts (al gebouwd!) richten op deze persona.** De interne Content Calendar maakt Instagram/Facebook-carrousels met tips. Gebruik de pijlers uit `lib/contentCalendar/brand.ts` en voeg de pijler "bol.com-verkopen" toe. Elke carrousel eindigt met dezelfde CTA: "Probeer het met je eigen mail: sequenceflow.io".
3. **Google Search (€55–60/dag) blijft** zoals in de strategie, maar voeg zoekwoorden toe die niemand koopt: "bol.com klantvragen automatisch beantwoorden", "bol partner klantenservice ai", "webshop klantenservice uitbesteden" (die zoeker wil geen virtual assistant van €25/uur als hij €79/maand kan betalen), "woocommerce klantenservice ai", "klantenservice e-mail sjablonen webshop".
4. **Meta prospecting (€30–40/dag)** met de nieuwe angles uit 6.4, video-first (zie 6.5). Eén ad set, brede targeting (NL, 25–55, interesses: Shopify, WooCommerce, bol.com partner, Lightspeed), laat de creative kwalificeren.
5. **Affiliate- en doorverwijsprogramma (al gebouwd):** activeer het bij de eerste 10 klanten persoonlijk (mail van de oprichter: "je krijgt 20% van je eigen maandbedrag per klant die je aanbrengt"). Voor affiliates: benader 10 Nederlandse e-commerce-YouTubers/LinkedIn-schrijvers met 2–20k volgers; 10% recurring is voor hen interessant. Zet `AFFILIATE_LEADERBOARD_LIVE=true` pas als er 3 echte affiliates zijn (anders vallen de demo-cijfers op).
6. **Shopify App Store-listing optimaliseren:** de app staat live en "Fully visible". Vraag elke klant die via Shopify installeert na 14 dagen actief om een review (in-app banner, één keer). Reviews zijn de belangrijkste rankingfactor daar. Voeg de screenshots van het ROI-blok (F-01) toe aan de listing.
7. **Partnerschappen met NL e-commerce-bureaus en fulfilmentpartijen** (Monta, Active Ants, Shopify-bureaus): zij hebben honderden klanten met precies dit probleem. Bied white-label of een partnerkorting; het affiliateprogramma is de technische basis.
8. **Vergelijkingspagina's voor SEO:** `/vergelijk/support-one-vs-chatgpt`, `/vs-gorgias`, `/vs-trengo`, `/vs-shopify-inbox`. Eerlijk, met een tabel. Deze pagina's ranken snel voor "alternatief voor X" en vangen de koper die al zoekt. De `lib/marketing/landingPages.ts`-structuur ondersteunt dit al.

### 6.4 Advertentie-angles (voor Meta, Instagram, TikTok, YouTube Shorts)

Elke angle: hook (eerste 2 seconden/eerste regel), belofte, bewijs, CTA. Alles binnen de Brand DNA-guardrails: geen percentages beloven zonder meting, "gecontroleerd" blijft het woord.

**A. Pijn/herkenning (koude doelgroep)**

1. **"Waar blijft mijn pakket."** Hook: een telefoonscherm met 14 keer dezelfde onderwerpregel. Tekst: "Je weet het antwoord al. Je typt het alleen 14 keer. Support One typt het voor je, met de echte trackingstatus erin, en jij klikt op Versturen." CTA: 14 dagen gratis.
2. **Zondagavond-inbox.** Hook: "Het is zondag 21:47 en je beantwoordt klantmail." Belofte: "Maandagochtend staan de concepten klaar. Jij leest, past aan, verstuurt. Of laat het Support One doen voor de vragen die je vertrouwt."
3. **De eerste medewerker.** Hook: "Je overweegt iemand aan te nemen voor support. Reken even mee." Een supportmedewerker kost €3.000+/maand; Support One €79–€549 en doet het repetitieve deel. "Neem iemand aan voor het werk dat een mens nodig heeft."
4. **Vakantie.** Hook: "Wanneer was je laatste week zonder inbox?" Belofte: autosend binnen jouw regels, escalatie naar jou alleen bij twijfel.
5. **Piekdrukte.** Hook: "Black Friday: 4x zoveel bestellingen, 4x zoveel vragen, dezelfde jij." Timing: oktober–november, en januari (retouren).

**B. Onderscheid (voor wie al "AI voor support" overweegt)**

6. **"Ik gebruik gewoon ChatGPT."** Hook: split-screen. Links: kopiëren, plakken, prompt, kopiëren, plakken. Rechts: de mail komt binnen, het concept staat er, inclusief bestelstatus uit bol.com. "ChatGPT schrijft een antwoord. Support One werkt in je mailbox."
7. **Veilige acties.** Hook: "Zou jij een AI je bestellingen laten annuleren?" Antwoord: "Wij ook niet zonder jouw klik. Support One stelt de annulering voor, controleert de live orderstatus, blijft onder jouw limiet, en voert pas uit als jij goedkeurt. Met audit-log." Dit is de angle voor de sceptische ondernemer.
8. **bol.com + Shopify + WooCommerce in één overzicht.** Hook: drie tabbladen worden één inbox. "Elke klantvraag, van elk kanaal, met de juiste bestelling erbij."
9. **Jouw beleid, niet dat van de AI.** Hook: "Een AI die 'coulance' zegt terwijl jouw retourtermijn 14 dagen is, kost je geld." Belofte: concepten komen uit jouw voorwaarden en leren van wat jij aanpast.
10. **Nederlands en AVG.** Hook: "Verwerkersovereenkomst, bewaartermijnen, data in de EU. Saai. Wel geregeld." Voor de ondernemer die bij een Amerikaanse tool twijfelt.

**C. Opbrengst (pas na F-01, met echte of expliciet gelabelde demodata)**

11. **"Deze maand: 11 uur, 3 behouden bestellingen."** Screenshot van het ROI-blok. Label duidelijk "voorbeeldwinkel" tot er klanttoestemming is.
12. **De maandagbriefing.** Hook: een mail-notificatie: "Top 3 problemen deze week: maat M groen, vertraagde PostNL-zendingen, retourlabel niet gevonden." "Je weet wat je klanten dwarszit zonder één mail te openen."
13. **Vóórdat de klant mailt.** (Na F-03.) Hook: "Deze klant kreeg bericht over haar vertraging vóórdat ze het zelf merkte. Ze mailde: 'Top, bedankt.'" 

**D. Sociaal bewijs en founder-stem**

14. **Oprichtersvideo (Navaron), 30 seconden, telefoon, geen montage.** "Ik bouw Support One omdat ik zag hoeveel webshop-eigenaren 's avonds nog klantmail doen. Dit is wat het doet. Probeer het twee weken; het kost je niets en je mailbox blijft gewoon je mailbox." Authentieke founder-ads presteren in deze niche consequent beter dan gepolijste.
15. **Klantquote-kaarten** zodra er drie klanten zijn die het willen. Eén zin, naam, winkel, aantal bestellingen per dag. Geen cijfers die niet gemeten zijn.
16. **"Wat Support One niet doet."** Hook: contra-intuïtief. "Het belooft geen korting die jij niet geeft. Het verzint geen bezorgdatum. Het annuleert niets zonder jou. Daarom durven webshops het aan te zetten." Eerlijkheid als onderscheid.

**E. Formats die het goed doen op TikTok/Reels/Shorts**

17. **"POV: je supportinbox op maandag"** (schermopname, snel, muziek) → eindigt in de Support One-inbox met concepten.
18. **"Rate my customer service reply"**: een echte (geanonimiseerde) klantvraag, het AI-concept, en de ondernemer die één woord aanpast en op Versturen klikt. Serie-potentieel.
19. **"3 klantvragen die je kunt voorkomen"** per week, uit de pijnpuntenanalyse (`painPoints.ts`). Educatief, deelbaar, bewijst de "inzicht"-belofte.
20. **"Wij lazen 1.000 webshopmails. Dit vraagt iedereen."** Data-content (geanonimiseerd, geaggregeerd, alleen met toestemming of uit eigen testwinkels).

### 6.5 Creatieve productie, praktisch

- **Video eerst.** Statische SVG-ads (`marketing/creatives/`) zijn netjes maar converteren op Meta slechter dan 15–30 s schermopnames. Neem met één tool (Screen Studio of Loom) vijf schermopnames op: mail komt binnen → concept → aanpassen → versturen; bol-order erbij; annulering goedkeuren; ROI-blok; maandagmail. Ondertitel altijd (geluid staat uit).
- **Test per week één variabele**, zoals de strategie al zegt. Begin met angle 1, 6 en 7 als controls (pijn, ChatGPT-vergelijking, veilige acties).
- **Landingspagina per angle**: angle 6 → `/vergelijk/support-one-vs-chatgpt`; angle 7 → `/for/webshops` met de actie-flow bovenaan; angle 8 → nieuwe `/for/bol-verkopers`. Voeg `bol-verkopers` toe aan `lib/marketing/landingPages.ts`.
- **CTA**: "Probeer 14 dagen gratis, zonder creditcard" blijft; test daarnaast "Plak één klantmail en zie het concept" (F-06 publieke demo) als lagere drempel.

### 6.6 Funnel-metrics en beslisregels (aanvulling op de €100/dag-strategie)

| Stap | Meting (al in de code) | Doel maand 1–3 |
|---|---|---|
| Bezoek → signup | `marketing_events` `landing_view` → `signup_completed` | ≥ 4% |
| Signup → mailbox gekoppeld | `tenant_email_channels.status = active` binnen 48 u | ≥ 50% (meet de Gmail-doorstuurstap apart; de roadmap wil dit weten) |
| Mailbox → eerste concept bekeken | `support_decisions` met `review_status != ignored` | ≥ 80% van gekoppelde |
| Eerste concept → eerste verstuurd | `outcome = manual_send` | ≥ 60% |
| Trial → betaald | `tenants.plan` ≠ trial/expired op dag 15–21 | ≥ 20% |
| Betaald → maand 3 | geen `customer.subscription.deleted` | ≥ 85% |

Bouw één interne pagina `/admin/funnel` (alleen `isTeamWhitelistedEmail`) die deze zes getallen per week toont. Dat is een halve dag werk en vervangt elke spreadsheet. Beslissingen: stopt de funnel bij "mailbox gekoppeld", dan is de Gmail-doorstuurstap het probleem (de roadmap heeft daar al het plan voor: Unipile/Nylas of eigen CASA-audit). Stopt hij bij "eerste verstuurd", dan is de kwaliteit van de concepten het probleem: dan eerst kennisbank-onboarding verbeteren, niet meer adverteren.

### 6.7 Prijs en aanbod

- De prijzen (€79/€229/€549) zijn goed gepositioneerd onder Gorgias/Trengo en boven "gratis ChatGPT". Verander ze niet tijdens de eerste 50 klanten.
- **Overweeg één wijziging:** een **jaarplan met 2 maanden gratis**, pas nadat F-01 bewijst dat klanten blijven. Jaarplannen halveren churn-risico en financieren advertenties vooruit.
- **Early-adopter-garantie** voor de eerste 20 betalende klanten: prijs vast voor 2 jaar. Kost niets, geeft urgentie en een reden om nu te beslissen.

### 6.8 90-dagenplan marketing

**Weken 1–2:** WP-01 t/m WP-05 live (vertrouwen), F-01 ROI-blok gebouwd, oprichtersvideo opgenomen, `/for/bol-verkopers` en `/vergelijk/…-vs-chatgpt` live, vijf schermopnames gemaakt.
**Weken 3–6:** Google Search + Meta aan (angles 1, 6, 7). Wekelijks één waardepost in bol.com-groepen. Content Calendar op 3 posts/week. Persoonlijke mail naar elke trial op dag 2, 7 en 12 (door de oprichter, geen automation; dat kan later).
**Weken 7–10:** F-02 maandagbriefing live; angles 11–12 toevoegen. Eerste drie klantquotes. Affiliate-outreach naar 10 creators. Shopify-reviewverzoek in-app.
**Weken 11–13:** evalueren op cost per activated account per angle; één persona en één belofte kiezen voor Q1 2027; F-03 (proactieve vertragingsmail) als volgende grote feature-launch met eigen campagne.

---

## Deel 7. Volgorde van alles, samengevat

| Week | Techniek | Product | Marketing |
|---|---|---|---|
| 1 | WP-01, WP-02, WP-03, WP-09 | – | oprichtersvideo, schermopnames |
| 2 | WP-04, WP-05, WP-07 | F-01 ROI-blok | landingspagina's bol/vs-chatgpt |
| 3 | WP-06, WP-08 | F-06 onboarding-checklist | ads aan (angles 1, 6, 7); bol-groepen |
| 4 | WP-10, WP-11 | F-02 maandagbriefing | funnel-pagina; dag-2/7/12-mails |
| 5–8 | onderhoud | F-03 vertragingsmelding; F-06 publieke demo | angles 11–12; affiliates; reviews |
| 9–13 | – | F-04 retourlabel/adres; F-05 wachtlijst | evaluatie; Q1-keuze |

Alles wat productie raakt (keys roteren, Vercel-variabelen, migraties met data-impact) alleen met akkoord van Navaron, zoals in `docs/plan-na-goedkeuring.md` staat.

---

## Deel 8. Review van de Vera-PR (#25), 4 november

Gelezen: alle migraties, API-routes, `lib/inventory/{alerts,alertsCore,assistant,assistantCore,waitlist,waitlistCore}.ts` en de MCP-tools. Het ontwerp is goed: Vera rekent niets zelf (grounding-check op elk getal), schrijft niets zelf (voorstellen worden pas door de browser met de rechten van de gebruiker uitgevoerd), en elke tabel heeft RLS. Wat ik vond, met wat al is gefixt:

| # | Ernst | Waar | Probleem | Status |
|---|---|---|---|---|
| V-01 | **Hoog** (mail naar eindklanten) | `lib/inventory/waitlist.ts` `sendWaitlist` | Eerst versturen, dan registreren. Twee admins die tegelijk op Verstuur klikken, of een retry na een time-out (route heeft `maxDuration 60`, de lus is sequentieel), mailen dezelfde klant twee keer. | **Gefixt:** eerst claimen via de unieke sleutel, pas dan versturen; mislukt de verzending, dan wordt de claim weer vrijgegeven. Antwoord bevat nu ook `skipped`. |
| V-02 | Laag | `lib/inventory/assistant.ts` `assistantQuestionsToday` | `T00:00:00+01:00` hardgecodeerd: in de zomertijd begint "vandaag" een uur te laat. | **Gefixt:** `startOfShopDay()` in `core.ts` (Amsterdam-middernacht, winter en zomer), met test. |
| V-03 | Midden | `lib/inventory/alerts.ts` `sendInventoryAlertEmail` | Mislukt de mail aan de tweede admin, dan wordt niets als gemaild gemarkeerd en krijgt de eerste admin morgen dezelfde mail nog eens. | **Gefixt:** per ontvanger try/catch; markeren zodra één mail is afgeleverd. |
| V-04 | Laag | `alerts.ts`, `email.ts`, `mailboxAlerts.ts` | Links in mails gebruiken `NEXT_PUBLIC_SITE_URL` (de marketingsite); `/inventory` daar is een 308 naar de app. Werkt, maar met een omweg en afhankelijk van de proxy. | **Gefixt:** `configuredAppOrigin()` uit `lib/brand.ts`. |
| V-05 | Midden (prestaties, niet alleen Vera) | `lib/billing.ts` `resolveTenantPlanAccess` | Elke aanroep (vrijwel elke API-route, ook `alerts/count` bij elke paginaweergave) doet `auth.admin.getUserById` per teamlid om de whitelist te controleren. Bij 5 teamleden zijn dat 5 extra Auth-calls per request. | Open. Voorstel: whitelist-uitkomst 5 minuten cachen per tenant (in-process Map; op Vercel per instance, nog steeds 10–50× minder calls), of een kolom `tenants.plan_override`. Halve dag. |
| V-06 | Midden (prestaties) | `lib/inventory/waitlist.ts` `loadWaitlist` | Laadt bij elke aanroep (chat-tool, GET, POST) alle gesprekken van 90 dagen met alle inbound-berichten opnieuw; dat is hetzelfde werk als het rapport bouwen. | Open. Voorstel: de wachtlijst-kandidaten per variant in het rapport opslaan bij `rebuildInventoryReport` (alleen conversation-id's, geen adressen), zodat `loadWaitlist` nog maar één query hoeft te doen. 2 uur. |
| V-07 | Laag (kosten) | `assistantCore.ts` | Per chatvraag tot 6 toolrondes met elk tot 60.000 tekens tooluitvoer in de prompt. Worst case ≈ 90k tokens per ronde. Bij 60 vragen per gebruiker per dag is het plafond ruim €10/dag/gebruiker. In de praktijk veel minder, maar het is onbegrensd per tenant. | Open. Voorstel: `TOOL_RESULT_MAX` naar 24.000 en een tenantlimiet van 200 vragen per dag naast de gebruikerslimiet. 1 uur. |
| V-08 | Laag | `app/api/inventory/alerts/route.ts` DELETE | Een regel verwijderen cascadeert naar álle meldingen van die regel, ook de opgeloste historie. | Bewuste keuze; prima. Alleen noteren in de UI ("verwijdert ook de geschiedenis"). |
| V-09 | Info | `inventory_waitlist_sends` | Alleen e-mailadres + conversation_id; geen naam, geen tekst. Netjes voor de AVG. De opschoon-cron ruimt deze tabel niet op. | Voeg in `cleanup-old-email` een retentie van 24 maanden toe, zoals bij de andere operationele tabellen. 10 minuten. |
| V-10 | Info | Migratienummers | Vera gebruikt 061–063; de security-PR schoof daarom naar 064–067. De foutmeldingen in de routes ("migratie 061 is nog niet gedraaid") kloppen met `main`. | Geen actie. |

**Niet gevonden (gecontroleerd):** tenant-lekken in de Vera-routes (alles via `inventoryContext` + `tenant_id`-filters), prompt-injectie via klantmail in Vera (tooluitvoer bevat geen ruwe klanttekst, alleen tellingen en labels), ongeautoriseerde schrijfacties (voorstellen vereisen `canManage` én het echte endpoint controleert opnieuw).

**Blijft van de PR-to-dolijst:** in de browser testen en één echte wachtlijstmail naar een eigen testadres, vóór een klant dit ziet.
