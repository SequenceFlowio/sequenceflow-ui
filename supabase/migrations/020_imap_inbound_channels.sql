-- 020_imap_inbound_channels.sql
-- Adds direct mailbox receiving via IMAP so ReplyOS can ingest customer mail
-- without requiring forwarding to the ReplyOS inbound domain.

ALTER TABLE tenant_email_channels
  ADD COLUMN IF NOT EXISTS imap_provider text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS imap_host text,
  ADD COLUMN IF NOT EXISTS imap_port integer,
  ADD COLUMN IF NOT EXISTS imap_encryption text NOT NULL DEFAULT 'ssl',
  ADD COLUMN IF NOT EXISTS imap_username text,
  ADD COLUMN IF NOT EXISTS imap_password_encrypted text,
  ADD COLUMN IF NOT EXISTS imap_mailbox text NOT NULL DEFAULT 'INBOX',
  ADD COLUMN IF NOT EXISTS imap_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS imap_last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS imap_last_error text,
  ADD COLUMN IF NOT EXISTS imap_uid_validity text,
  ADD COLUMN IF NOT EXISTS imap_last_uid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imap_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS imap_poll_interval_seconds integer NOT NULL DEFAULT 60;

ALTER TABLE tenant_email_channels
  DROP CONSTRAINT IF EXISTS tenant_email_channels_imap_encryption_check;

ALTER TABLE tenant_email_channels
  ADD CONSTRAINT tenant_email_channels_imap_encryption_check
  CHECK (imap_encryption IN ('starttls', 'ssl', 'none'));

ALTER TABLE tenant_email_channels
  DROP CONSTRAINT IF EXISTS tenant_email_channels_imap_status_check;

ALTER TABLE tenant_email_channels
  ADD CONSTRAINT tenant_email_channels_imap_status_check
  CHECK (imap_status IN ('not_configured', 'test_required', 'active', 'failed'));

CREATE INDEX IF NOT EXISTS idx_tenant_email_channels_imap_status
  ON tenant_email_channels (tenant_id, imap_status)
  WHERE is_default = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_imap_provider_message_unique
  ON support_messages (tenant_id, provider, provider_message_id)
  WHERE provider = 'imap' AND provider_message_id IS NOT NULL;
