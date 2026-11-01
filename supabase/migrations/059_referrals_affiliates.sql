-- Doorverwijzen (klanten, max 5 beloningen als tegoed) en affiliates (commissie, met of zonder account).
-- Regels en bedragen: lib/referrals/program.ts. Alleen server-side met de service role.

-- Wie heeft deze workspace binnengebracht
alter table tenants add column if not exists referral_code text unique;
alter table tenants add column if not exists referred_by_tenant_id uuid references tenants(id) on delete set null;
alter table tenants add column if not exists affiliate_id uuid;
alter table tenants add column if not exists referral_credit_applied_at timestamptz;

create table if not exists affiliates (
  id                  uuid        primary key default gen_random_uuid(),
  username            text        not null unique check (username ~ '^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$'),
  name                text        not null,
  email               text        not null,
  is_business         boolean     not null default false,
  company_name        text,
  kvk_number          text,
  vat_number          text,
  channel             text,       -- waar ze promoten (website, Instagram, nieuwsbrief …)
  show_on_leaderboard boolean     not null default true,
  status              text        not null default 'active' check (status in ('active', 'paused', 'blocked')),
  access_token_hash   text        not null,
  user_id             uuid,       -- als ze ook een SequenceFlow-account hebben
  created_at          timestamptz not null default now()
);
create index if not exists affiliates_email_idx on affiliates (lower(email));

alter table tenants drop constraint if exists tenants_affiliate_id_fkey;
alter table tenants add constraint tenants_affiliate_id_fkey foreign key (affiliate_id) references affiliates(id) on delete set null;
create index if not exists tenants_affiliate_idx on tenants (affiliate_id) where affiliate_id is not null;
create index if not exists tenants_referred_by_idx on tenants (referred_by_tenant_id) where referred_by_tenant_id is not null;

-- Elke beloning of commissie is een regel; uitbetalen of verrekenen verandert alleen de status.
create table if not exists referral_rewards (
  id                  uuid        primary key default gen_random_uuid(),
  kind                text        not null check (kind in ('affiliate_commission', 'referrer_credit')),
  affiliate_id        uuid        references affiliates(id) on delete set null,
  referrer_tenant_id  uuid        references tenants(id) on delete set null,
  referred_tenant_id  uuid        not null references tenants(id) on delete cascade,
  customer_number     int,        -- de hoeveelste betalende klant van deze affiliate (bepaalt het percentage)
  stripe_invoice_id   text        not null,
  stripe_payment_ref  text,       -- PaymentIntent of charge, om terugbetalingen te herkennen
  base_cents          int         not null, -- factuurbedrag excl. btw
  rate                numeric(5,4),
  amount_cents        int         not null,
  currency            text        not null default 'eur',
  status              text        not null default 'pending' check (status in ('pending', 'available', 'paid', 'reversed')),
  invoice_paid_at     timestamptz not null,
  available_at        timestamptz not null,
  settled_at          timestamptz,
  settlement_ref      text,       -- Stripe-saldotransactie of betalingskenmerk
  created_at          timestamptz not null default now(),
  unique (kind, stripe_invoice_id)
);
create index if not exists referral_rewards_affiliate_idx on referral_rewards (affiliate_id, status);
create index if not exists referral_rewards_referrer_idx on referral_rewards (referrer_tenant_id, status);
create index if not exists referral_rewards_due_idx on referral_rewards (available_at) where status = 'pending';
create index if not exists referral_rewards_payment_idx on referral_rewards (stripe_payment_ref) where stripe_payment_ref is not null;

-- Openstaand per affiliate, voor de maandelijkse uitbetaling
create or replace view affiliate_balances as
select a.id as affiliate_id, a.username, a.name, a.email, a.is_business, a.company_name, a.vat_number,
       coalesce(sum(r.amount_cents) filter (where r.status = 'available'), 0) as available_cents,
       coalesce(sum(r.amount_cents) filter (where r.status = 'pending'), 0)   as pending_cents,
       coalesce(sum(r.amount_cents) filter (where r.status = 'paid'), 0)      as paid_cents
from affiliates a
left join referral_rewards r on r.affiliate_id = a.id and r.kind = 'affiliate_commission'
group by a.id;

alter table affiliates enable row level security;
alter table referral_rewards enable row level security;
revoke all on affiliate_balances from anon, authenticated;
