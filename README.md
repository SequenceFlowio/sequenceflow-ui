# SequenceFlow UI

SequenceFlow is a Next.js application for controlled AI customer support by email. It connects an existing support mailbox, drafts replies from tenant knowledge, keeps human approval as the default, and offers controlled auto-send on eligible plans.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The public marketing site is at `/`; authenticated product routes start at `/inbox`.

## Verification

```bash
npm run check
npm audit --omit=dev
```

`npm run check` runs ESLint, Node tests, and a production Next.js build.

## Database

Apply every SQL migration in `supabase/migrations` in numerical order, currently through `040_cancellation_confirmation_queue.sql`. Migrations `028` through `031` add the commerce, learning, action, outcome, case-memory, metrics, and atomic execution foundation; migration `032` adds tenant-managed exact sender filtering, migration `033` adds reversible ticket archiving, migration `034` enables WooCommerce as the active pilot provider, migration `035` makes commerce webhook processing retryable and lease-based, migration `036` makes provider disconnects transactional and provider-specific, migration `037` expires normalized order PII after its active cases and actions no longer need it, migration `038` enforces tenant ownership across every commerce relationship at the database layer, migration `039` prevents long-term cleanup from removing a blocking action from an active or retained case, and migration `040` durably prepares a verified cancellation confirmation before a reply can be sent.

The cleanup cron removes completed ticket content after 90 days. Pseudonymous case memory, operational metadata, and sanitised commerce audit events expire after 24 months. Configure it to call `/api/cron/cleanup-old-email` with `Authorization: Bearer $CRON_SECRET`.

## Required services

- Supabase for authentication, tenant data, storage, and RLS.
- OpenAI API for drafting, translation, embeddings, and pain-point analysis.
- Resend for inbound webhook processing and service email.
- Stripe for subscriptions.
- Vercel or another Node-compatible host for Next.js and cron endpoints.

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, mail credentials, Stripe secrets, or webhook secrets to the browser.
- `RESEND_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `INTERNAL_API_SECRET`, and `CRON_SECRET` are required in production; their routes fail closed.
- Keep `INTERNAL_API_SECRET` separate from `CRON_SECRET`; internal AI pipeline calls send it as `x-internal-secret`. `CRON_SECRET` remains a temporary compatibility fallback.
- Mail credentials are encrypted with `SMTP_CREDENTIAL_ENCRYPTION_KEY` before storage.
- WooCommerce consumer secrets and webhook secrets require the separate `COMMERCE_CREDENTIAL_ENCRYPTION_KEY`; customer matching requires `COMMERCE_IDENTITY_HMAC_KEY`. Commerce never falls back to the mail encryption key.
- Public campaign tracking stores only attribution/event metadata, not email content or names.
- Runtime uploads belong in Supabase Storage. `public/uploads` is ignored and must never contain deployment assets or customer data.

## Go-to-market

The canonical Brand DNA, personas, campaign copy, ad-set structure, editable creatives, and €100/day plan live in [`marketing`](./marketing/README.md).

## Commerce pilot

The merchant setup, shadow/review workflow, incident path, weekly scorecard, and live acceptance checklist are in [`docs/commerce-pilot-runbook.md`](./docs/commerce-pilot-runbook.md).

After a live pilot flow, `npm run commerce:verify-pilot` verifies its database and WooCommerce evidence using `PILOT_TENANT_ID` and `PILOT_CONVERSATION_ID`.
