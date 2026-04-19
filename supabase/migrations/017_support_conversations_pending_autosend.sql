-- 017_support_conversations_pending_autosend.sql
-- Adds 'pending_autosend' to the support_conversations.status check constraint.
-- Migration 016 created this table without it, causing silent update failures in
-- the AI pipeline when autosend is enabled.

ALTER TABLE support_conversations
  DROP CONSTRAINT IF EXISTS support_conversations_status_check;

ALTER TABLE support_conversations
  ADD CONSTRAINT support_conversations_status_check
  CHECK (status IN ('open', 'review', 'pending_autosend', 'sent', 'escalated', 'ignored', 'closed'));

-- Index for the autosend cron to efficiently find pending_autosend conversations
CREATE INDEX IF NOT EXISTS idx_support_conversations_pending_autosend
  ON support_conversations (tenant_id, status)
  WHERE status = 'pending_autosend';
