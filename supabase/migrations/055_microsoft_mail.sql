-- Outlook / Microsoft 365 without a password: "Sign in with Microsoft"
-- (Microsoft Graph, Mail.Read + Mail.Send). Mail is read straight from the
-- inbox, so no forwarding is needed. Server-side tables only.

CREATE TABLE tenant_microsoft_connections (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  microsoft_user_id text NOT NULL,
  microsoft_email text NOT NULL,
  refresh_token_encrypted text,
  access_token_encrypted text,
  access_expires_at timestamptz,
  scopes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','needs_reconnect','revoked')),
  -- Mail received at or after this moment is read; set to the connect time,
  -- so connecting never imports the old inbox.
  inbox_cursor timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  connected_by uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tenant_microsoft_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tenant_microsoft_connections FROM anon, authenticated;

-- One-time sign-in attempts, same shape as google_oauth_states.
CREATE TABLE microsoft_oauth_states (
  state_hash text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  started_by uuid,
  code_verifier text NOT NULL,
  return_to text NOT NULL DEFAULT 'app' CHECK (return_to IN ('app','shopify')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE microsoft_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON microsoft_oauth_states FROM anon, authenticated;
CREATE INDEX microsoft_oauth_states_expiry ON microsoft_oauth_states(expires_at);

CREATE FUNCTION consume_microsoft_oauth_state(p_state_hash text)
RETURNS TABLE(tenant_id uuid, started_by uuid, code_verifier text, return_to text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE microsoft_oauth_states s SET used_at = now()
    WHERE s.state_hash = p_state_hash AND s.used_at IS NULL AND s.expires_at > now()
    RETURNING s.tenant_id, s.started_by, s.code_verifier, s.return_to;
END $$;
REVOKE ALL ON FUNCTION consume_microsoft_oauth_state(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_microsoft_oauth_state(text) TO service_role;

ALTER TABLE tenant_email_channels DROP CONSTRAINT tenant_email_channels_outbound_provider_check;
ALTER TABLE tenant_email_channels ADD CONSTRAINT tenant_email_channels_outbound_provider_check
  CHECK (outbound_provider IN ('smtp','gmail_api','microsoft_graph'));
