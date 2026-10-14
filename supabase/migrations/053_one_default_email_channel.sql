-- One default mailbox per workspace. The setup page now creates the default
-- channel for a brand-new workspace (so it gets a readable forwarding address
-- right away); this index makes two simultaneous page loads safe.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_email_channels_one_default
  ON tenant_email_channels(tenant_id) WHERE is_default;
