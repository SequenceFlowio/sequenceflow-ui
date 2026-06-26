-- Per-ticket retention pin. When retention_exempt = true the cleanup cron
-- (api/cron/cleanup-old-email) will never auto-delete the row, regardless of
-- age or status. Lets users keep important cases (legal-sensitive complaints,
-- reference cases) in the app indefinitely.

ALTER TABLE support_conversations
  ADD COLUMN IF NOT EXISTS retention_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS retention_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN support_conversations.retention_exempt IS 'When true, excluded from automatic retention cleanup.';
COMMENT ON COLUMN tickets.retention_exempt IS 'When true, excluded from automatic retention cleanup.';
