-- Beheerdashboard (sequenceflow.io/backoffice): meldingen per mail aan de beheerders,
-- en het OpenAI-tegoed zoals een beheerder het van platform.openai.com overneemt.
-- Alleen server-side met de service role.

-- Welke melding al verstuurd is: één regel per gebeurtenis, zodat niemand dezelfde mail twee keer krijgt.
create table if not exists backoffice_notifications (
  id          uuid        primary key default gen_random_uuid(),
  kind        text        not null,
  ref         text        not null,          -- werkruimte, abonnement of tegoedstand waar het over gaat
  tenant_id   uuid        references tenants(id) on delete set null,
  sent_at     timestamptz not null default now(),
  unique (kind, ref)
);
create index if not exists backoffice_notifications_sent_idx on backoffice_notifications (sent_at desc);

-- OpenAI heeft geen API voor het resterende tegoed: een beheerder neemt het over van de
-- billingpagina; het dashboard trekt daar de kosten sinds dat moment van af.
create table if not exists openai_credit_snapshots (
  id          uuid          primary key default gen_random_uuid(),
  balance_usd numeric(12,2) not null check (balance_usd >= 0),
  noted_at    timestamptz   not null default now(),
  noted_by    text
);
create index if not exists openai_credit_snapshots_noted_idx on openai_credit_snapshots (noted_at desc);

alter table backoffice_notifications enable row level security;
alter table openai_credit_snapshots enable row level security;
revoke all on backoffice_notifications from anon, authenticated;
revoke all on openai_credit_snapshots from anon, authenticated;
