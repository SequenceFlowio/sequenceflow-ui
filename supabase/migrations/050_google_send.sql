-- Gmail without an app password: receive via forwarding, send via
-- "Sign in with Google" (gmail.send only). Server-side tables only.

CREATE TABLE tenant_google_connections (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  google_sub text NOT NULL,
  google_email text NOT NULL,
  refresh_token_encrypted text,
  access_token_encrypted text,
  access_expires_at timestamptz,
  scopes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','needs_reconnect','revoked')),
  connected_by uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tenant_google_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tenant_google_connections FROM anon, authenticated;

-- One-time sign-in attempts. Only the SHA-256 of the state is stored; the
-- PKCE verifier never leaves the server.
CREATE TABLE google_oauth_states (
  state_hash text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  started_by uuid,
  code_verifier text NOT NULL,
  return_to text NOT NULL DEFAULT 'app' CHECK (return_to IN ('app','shopify')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE google_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON google_oauth_states FROM anon, authenticated;
CREATE INDEX google_oauth_states_expiry ON google_oauth_states(expires_at);

-- Which way replies go out. 'smtp' keeps today's behaviour for everyone.
ALTER TABLE tenant_email_channels
  ADD COLUMN outbound_provider text NOT NULL DEFAULT 'smtp' CHECK (outbound_provider IN ('smtp','gmail_api')),
  ADD COLUMN forwarding_status text NOT NULL DEFAULT 'none' CHECK (forwarding_status IN ('none','pending','confirmed','rejected')),
  ADD COLUMN forwarding_requested_by text,
  ADD COLUMN forwarding_code text,
  ADD COLUMN forwarding_updated_at timestamptz;

-- Single use, atomically: a replayed or late callback gets nothing back.
CREATE FUNCTION consume_google_oauth_state(p_state_hash text)
RETURNS TABLE(tenant_id uuid, started_by uuid, code_verifier text, return_to text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE google_oauth_states s SET used_at = now()
    WHERE s.state_hash = p_state_hash AND s.used_at IS NULL AND s.expires_at > now()
    RETURNING s.tenant_id, s.started_by, s.code_verifier, s.return_to;
END $$;
REVOKE ALL ON FUNCTION consume_google_oauth_state(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_google_oauth_state(text) TO service_role;
