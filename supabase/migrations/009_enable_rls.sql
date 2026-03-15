-- ─── 009_enable_rls.sql ───────────────────────────────────────────────────────
-- Enable RLS on all public tables and add tenant isolation policies.
--
-- Policy helper used throughout:
--   (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
--
-- Notes:
--   - agent_config has no tenant_id → skipped (single global row, internal use)
--   - knowledge_documents / knowledge_chunks use client_id instead of tenant_id
--   - support_events and tickets are written server-side via service role (admin
--     client bypasses RLS), so only SELECT policies are needed for end users
--   - tenant_integrations is written via service role in OAuth callback + n8n;
--     users only need SELECT to see their own integration status
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: reusable inline subquery ─────────────────────────────────────────
-- Avoids repeating the join everywhere. Used in each USING clause below.

-- ── tenants ──────────────────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON tenants
  FOR SELECT USING (
    id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

-- ── tenant_members ────────────────────────────────────────────────────────────
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON tenant_members
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

-- ── profiles ──────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON profiles
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "own_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ── tenant_integrations ───────────────────────────────────────────────────────
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON tenant_integrations
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

-- ── tenant_agent_config ───────────────────────────────────────────────────────
ALTER TABLE tenant_agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON tenant_agent_config
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_insert" ON tenant_agent_config
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_update" ON tenant_agent_config
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

-- ── tenant_templates ──────────────────────────────────────────────────────────
ALTER TABLE tenant_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON tenant_templates
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

-- ── support_agents ────────────────────────────────────────────────────────────
ALTER TABLE support_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON support_agents
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

-- ── support_events ────────────────────────────────────────────────────────────
-- Written server-side via service role; users can only read their own tenant's events.
ALTER TABLE support_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON support_events
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

-- ── tickets ───────────────────────────────────────────────────────────────────
-- RLS already enabled. Drop the old policy and replace with named ones that
-- also allow INSERT/UPDATE for the service role (handled via admin client,
-- which bypasses RLS entirely — these policies cover the UI read path).
DROP POLICY IF EXISTS "tenant_isolation" ON tickets;

CREATE POLICY "tenant_select" ON tickets
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_update" ON tickets
  FOR UPDATE USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

-- ── knowledge_documents ───────────────────────────────────────────────────────
-- Uses client_id instead of tenant_id (known schema discrepancy).
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON knowledge_documents
  FOR SELECT USING (
    client_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
    OR client_id IS NULL  -- platform-wide docs visible to all authenticated users
  );

-- ── knowledge_chunks ─────────────────────────────────────────────────────────
-- Also uses client_id.
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON knowledge_chunks
  FOR SELECT USING (
    client_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
    OR client_id IS NULL  -- platform-wide chunks visible to all authenticated users
  );
