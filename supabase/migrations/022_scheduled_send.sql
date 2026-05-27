-- 022_scheduled_send.sql
-- Adds per-draft scheduled sending with persisted attachments.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS scheduled_send_at timestamptz;

ALTER TABLE support_conversations
  ADD COLUMN IF NOT EXISTS scheduled_send_at timestamptz;

CREATE TABLE IF NOT EXISTS scheduled_reply_attachments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid       REFERENCES support_conversations(id) ON DELETE CASCADE,
  ticket_id      uuid        REFERENCES tickets(id) ON DELETE CASCADE,
  storage_bucket text        NOT NULL DEFAULT 'scheduled-reply-attachments',
  storage_path   text        NOT NULL,
  filename       text        NOT NULL,
  content_type   text,
  byte_size      integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (
    ((conversation_id IS NOT NULL)::int + (ticket_id IS NOT NULL)::int) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reply_attachments_conversation
  ON scheduled_reply_attachments (conversation_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_reply_attachments_ticket
  ON scheduled_reply_attachments (ticket_id)
  WHERE ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_conversations_scheduled_send
  ON support_conversations (scheduled_send_at)
  WHERE status = 'pending_autosend' AND scheduled_send_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_scheduled_send
  ON tickets (scheduled_send_at)
  WHERE status = 'pending_autosend' AND scheduled_send_at IS NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('scheduled-reply-attachments', 'scheduled-reply-attachments', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE scheduled_reply_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select" ON scheduled_reply_attachments;
CREATE POLICY "tenant_select" ON scheduled_reply_attachments
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );
