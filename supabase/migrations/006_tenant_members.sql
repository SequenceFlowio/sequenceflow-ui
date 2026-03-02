-- ─── Layer 6: Explicit tenant membership table ────────────────────────────────
-- Provides a many-to-many user ↔ tenant binding as an alternative (and eventual
-- replacement) for the one-to-one profiles table.
-- v2 assumption: each user belongs to exactly one tenant.
--
-- Migration order:
--   001_knowledge_tables.sql         → vector search infrastructure
--   002_knowledge_ingest_jobs.sql    → async ingest worker queue
--   003_multi_tenant_foundation.sql  → tenants, tenant_agent_config, support_events
--   004_profiles_rls.sql             → auth user → tenant binding (profiles) + RLS
--   005_support_events_user_id.sql   → per-user observability
--   006_tenant_members.sql (this)    → explicit membership table

create table if not exists tenant_members (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references tenants(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'admin',
  created_at timestamptz not null default now(),

  unique (tenant_id, user_id)
);

-- Primary lookup: resolve tenant for a given user
create index if not exists idx_tm_user_id   on tenant_members(user_id);
create index if not exists idx_tm_tenant_id on tenant_members(tenant_id);
