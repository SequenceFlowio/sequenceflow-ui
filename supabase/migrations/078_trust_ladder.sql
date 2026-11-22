-- Fase 3 werkstroomkern (docs/plan-werkstroomkern.md): de vertrouwensladder.
-- Alleen toevoegen; standaard verandert er niets aan wat er verstuurd wordt.

-- Trede en reeks per werkruimte en soort vraag (lib/trust/ladderCore.ts).
create table if not exists trust_levels (
  tenant_id      uuid        not null references tenants(id) on delete cascade,
  intent         text        not null,
  level          smallint    not null default 1 check (level between 1 and 3),
  streak         integer     not null default 0 check (streak >= 0),
  proposed_level smallint    check (proposed_level between 2 and 3),
  proposed_at    timestamptz,
  reason         text,
  updated_at     timestamptz not null default now(),
  primary key (tenant_id, intent)
);

-- Elke goedkeuring door een mens telt precies een keer; ook het logboek van de ladder.
create table if not exists trust_ladder_events (
  message_id  uuid        primary key references support_messages(id) on delete cascade,
  tenant_id   uuid        not null references tenants(id) on delete cascade,
  decision_id uuid,
  intent      text        not null,
  outcome     text        not null check (outcome in ('unchanged', 'edited', 'corrected')),
  change      text        not null,
  level_after smallint    not null,
  streak_after integer    not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_trust_ladder_events_tenant on trust_ladder_events (tenant_id, created_at desc);

alter table trust_levels enable row level security;
alter table trust_ladder_events enable row level security;

-- Wat de ladder bij dit concept zou doen (schaduw) of deed (aan).
alter table support_decisions add column if not exists ladder jsonb;

-- Schakelaar per werkruimte: pas aan als de ladder ook echt beslist.
alter table tenant_agent_config add column if not exists trust_ladder_enabled boolean not null default false;
