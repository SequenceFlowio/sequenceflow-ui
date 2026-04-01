-- 012_pain_point_analyses.sql
-- Caches AI-generated customer pain point briefings per tenant (24h TTL)

create table if not exists pain_point_analyses (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references tenants(id) on delete cascade,
  generated_at  timestamptz not null default now(),
  ticket_count  int         not null default 0,
  week_count    int         not null default 0,
  pain_points   jsonb       not null default '[]',
  intro         text        not null default ''
);

create index if not exists pain_point_analyses_tenant_time_idx
  on pain_point_analyses (tenant_id, generated_at desc);

-- RLS
alter table pain_point_analyses enable row level security;

create policy "tenant_isolation" on pain_point_analyses
  using (
    tenant_id in (
      select tenant_id from tenant_members where user_id = auth.uid()
    )
  );
