-- 013_autosend.sql
-- Adds auto-send scheduling to tenant_agent_config and extends tickets status.

-- 1. Drop the old status check constraint and add pending_autosend
alter table tickets
  drop constraint if exists tickets_status_check;

alter table tickets
  add constraint tickets_status_check
  check (status in ('draft', 'pending_autosend', 'approved', 'escalated', 'sent', 'ignored'));

-- 2. Add autosend columns to tenant_agent_config
alter table tenant_agent_config
  add column if not exists autosend_enabled   boolean       not null default false,
  add column if not exists autosend_threshold numeric(3,2)  not null default 0.85,
  add column if not exists autosend_time_1    text          not null default '08:00',
  add column if not exists autosend_time_2    text          not null default '16:00';

-- Index for the autosend cron: quickly find pending tickets
create index if not exists tickets_pending_autosend_idx
  on tickets (tenant_id, status)
  where status = 'pending_autosend';
