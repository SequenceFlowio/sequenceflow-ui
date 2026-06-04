-- 023_inbound_message_attachments.sql
-- Persists customer-sent attachments so operators can open damage photos.

CREATE TABLE IF NOT EXISTS inbound_message_attachments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id     uuid        NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  storage_bucket text        NOT NULL DEFAULT 'inbound-message-attachments',
  storage_path   text        NOT NULL,
  filename       text        NOT NULL,
  content_type   text,
  byte_size      integer     NOT NULL DEFAULT 0,
  content_id     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_message_attachments_message
  ON inbound_message_attachments (message_id);

CREATE INDEX IF NOT EXISTS idx_inbound_message_attachments_tenant
  ON inbound_message_attachments (tenant_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('inbound-message-attachments', 'inbound-message-attachments', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE inbound_message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select" ON inbound_message_attachments;
CREATE POLICY "tenant_select" ON inbound_message_attachments
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );
