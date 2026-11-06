-- Afgehandelde gesprekken: het gebruiksdeel van de factuur (vast bedrag +
-- €0,49 gecontroleerd / €0,99 zelfstandig). Eén rij per gesprek, ooit: zo
-- telt een gesprek nooit twee keer. Geen foreign key naar het gesprek, want
-- de bewaartermijn ruimt gesprekken op en de factuurregel moet blijven.

create table if not exists public.billing_handled_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null unique,
  kind text not null check (kind in ('ai_assisted', 'ai_autonomous')),
  rate_cents integer not null check (rate_cents >= 0),
  pricing_version text not null,
  sent_at timestamptz not null,
  final_at timestamptz not null,
  -- pending_report: nog naar Stripe; reported: staat op de factuur;
  -- over_budget: boven het maandbudget, gratis; not_billed: geen betaald abonnement.
  status text not null default 'pending_report' check (status in ('pending_report', 'reported', 'over_budget', 'not_billed')),
  stripe_customer_id text,
  reported_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists billing_handled_conversations_tenant_final_idx
  on public.billing_handled_conversations (tenant_id, final_at);

alter table public.billing_handled_conversations enable row level security;
revoke all on public.billing_handled_conversations from anon, authenticated;

-- Maximaal gebruiksbedrag per maand dat de klant zelf kiest (in centen).
-- Leeg = geen budget ingesteld.
alter table public.tenants add column if not exists usage_budget_cents integer check (usage_budget_cents is null or usage_budget_cents >= 0);
