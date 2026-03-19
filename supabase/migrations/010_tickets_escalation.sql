-- 010_tickets_escalation.sql
-- Adds escalation columns to tickets and escalation_departments config to tenant_agent_config.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS escalation_reason     text,
  ADD COLUMN IF NOT EXISTS escalation_department text;

ALTER TABLE tenant_agent_config
  ADD COLUMN IF NOT EXISTS escalation_departments jsonb NOT NULL DEFAULT '[]'::jsonb;
