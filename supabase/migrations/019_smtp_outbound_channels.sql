-- 019_smtp_outbound_channels.sql
-- Adds tenant SMTP configuration so customer-facing replies can be sent from
-- the customer's own mailbox instead of a shared ReplyOS/Resend sender.

ALTER TABLE tenant_email_channels
  ADD COLUMN IF NOT EXISTS smtp_provider text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer,
  ADD COLUMN IF NOT EXISTS smtp_encryption text NOT NULL DEFAULT 'starttls',
  ADD COLUMN IF NOT EXISTS smtp_username text,
  ADD COLUMN IF NOT EXISTS smtp_password_encrypted text,
  ADD COLUMN IF NOT EXISTS smtp_from_email text,
  ADD COLUMN IF NOT EXISTS smtp_from_name text,
  ADD COLUMN IF NOT EXISTS smtp_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS smtp_last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS smtp_last_error text;

ALTER TABLE tenant_email_channels
  DROP CONSTRAINT IF EXISTS tenant_email_channels_smtp_encryption_check;

ALTER TABLE tenant_email_channels
  ADD CONSTRAINT tenant_email_channels_smtp_encryption_check
  CHECK (smtp_encryption IN ('starttls', 'ssl', 'none'));

ALTER TABLE tenant_email_channels
  DROP CONSTRAINT IF EXISTS tenant_email_channels_smtp_status_check;

ALTER TABLE tenant_email_channels
  ADD CONSTRAINT tenant_email_channels_smtp_status_check
  CHECK (smtp_status IN ('not_configured', 'test_required', 'active', 'failed'));

CREATE INDEX IF NOT EXISTS idx_tenant_email_channels_smtp_status
  ON tenant_email_channels (tenant_id, smtp_status)
  WHERE is_default = true;
