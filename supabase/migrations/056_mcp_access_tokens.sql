-- Support One as an MCP server: a shop owner connects Claude, ChatGPT or
-- another MCP client, either with a personal access key or by signing in
-- (OAuth 2.1 with PKCE and dynamic client registration). Only SHA-256 hashes
-- of keys, codes and tokens are stored. Server-side tables only.

-- Apps that registered themselves (RFC 7591). Public clients: no secret.
CREATE TABLE mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_name text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 120),
  redirect_uris text[] NOT NULL CHECK (cardinality(redirect_uris) BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mcp_oauth_clients FROM anon, authenticated;

-- One-time authorization codes, valid for a few minutes.
CREATE TABLE mcp_oauth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mcp_oauth_codes FROM anon, authenticated;
CREATE INDEX mcp_oauth_codes_expiry ON mcp_oauth_codes(expires_at);

-- A shop that approved an app. The refresh token rotates on every use.
CREATE TABLE mcp_oauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid,
  refresh_token_hash text NOT NULL UNIQUE,
  refresh_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
ALTER TABLE mcp_oauth_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mcp_oauth_grants FROM anon, authenticated;
CREATE INDEX mcp_oauth_grants_tenant ON mcp_oauth_grants(tenant_id, created_at DESC);

-- Bearer tokens for /api/mcp: personal keys (no grant, no expiry) and
-- short-lived OAuth access tokens (grant_id and expires_at set).
CREATE TABLE mcp_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grant_id uuid REFERENCES mcp_oauth_grants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  token_hash text NOT NULL UNIQUE,
  token_hint text NOT NULL,
  -- 'read' only for now; actions will get their own scope and still run
  -- through the commerce approval and audit layer.
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[] CHECK (scopes <@ ARRAY['read']::text[]),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  CHECK ((grant_id IS NULL) = (expires_at IS NULL))
);
ALTER TABLE mcp_access_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mcp_access_tokens FROM anon, authenticated;
CREATE INDEX mcp_access_tokens_tenant ON mcp_access_tokens(tenant_id, created_at DESC);
CREATE INDEX mcp_access_tokens_grant ON mcp_access_tokens(grant_id) WHERE grant_id IS NOT NULL;
CREATE INDEX mcp_access_tokens_expiry ON mcp_access_tokens(expires_at) WHERE expires_at IS NOT NULL;
