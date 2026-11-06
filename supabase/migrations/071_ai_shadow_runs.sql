-- Een goedkoper model stil laten meedraaien naast het huidige, om te zien of het even goed beslist.
-- Alleen de uitkomst (geen mailinhoud). Opgeruimd door cleanup-old-email, net als ai_usage_events.
create table if not exists ai_shadow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  task text not null,
  main_model text not null,
  shadow_model text not null,
  main_result jsonb,
  shadow_result jsonb,
  agree boolean,
  created_at timestamptz not null default now()
);
create index if not exists ai_shadow_runs_task_created_idx on ai_shadow_runs (task, created_at desc);
alter table ai_shadow_runs enable row level security;
