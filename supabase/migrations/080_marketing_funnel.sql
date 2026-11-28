-- Funnel per week en per bron (backoffice, tab Funnel).
--
-- 1. marketing_events krijgt een grove soort bezoeker (client) en een vlag voor
--    eigen verkeer (internal). Geen volledige user-agent, geen IP: alleen een
--    label als 'browser', 'instagram' (in-app browser) of 'bot'.
-- 2. marketing_funnel_milestones(): per werkruimte het eerste moment van
--    mailbox gekoppeld, eerste concept en eerste verstuurde antwoord. Alleen
--    voor de service-role (het beheerdashboard).

ALTER TABLE marketing_events
  ADD COLUMN IF NOT EXISTS client text,
  ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_marketing_events_internal_created
  ON marketing_events (internal, created_at DESC);

CREATE OR REPLACE FUNCTION marketing_funnel_milestones()
RETURNS TABLE (tenant_id uuid, connected_at timestamptz, first_draft_at timestamptz, first_sent_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH connections AS (
    SELECT c.tenant_id, COALESCE(c.forwarding_updated_at, c.created_at) AS at
      FROM tenant_email_channels c
     WHERE c.forwarding_status = 'confirmed'
    UNION ALL
    SELECT c.tenant_id, c.created_at
      FROM tenant_email_channels c
     WHERE c.imap_status IN ('active', 'connected')
    UNION ALL
    SELECT g.tenant_id, g.connected_at FROM tenant_google_connections g WHERE g.status = 'active'
    UNION ALL
    SELECT m.tenant_id, m.connected_at FROM tenant_microsoft_connections m WHERE m.status = 'active'
  ),
  connected AS (SELECT c.tenant_id, min(c.at) AS at FROM connections c GROUP BY c.tenant_id),
  drafts AS (SELECT d.tenant_id, min(d.created_at) AS at FROM support_decisions d GROUP BY d.tenant_id),
  sent AS (
    SELECT e.tenant_id, min(e.created_at) AS at
      FROM support_events e
     WHERE e.outcome IN ('manual_send', 'autosend_sent', 'scheduled_send_sent')
     GROUP BY e.tenant_id
  )
  SELECT t.id, connected.at, drafts.at, sent.at
    FROM tenants t
    LEFT JOIN connected ON connected.tenant_id = t.id
    LEFT JOIN drafts ON drafts.tenant_id = t.id
    LEFT JOIN sent ON sent.tenant_id = t.id;
$$;

REVOKE ALL ON FUNCTION marketing_funnel_milestones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketing_funnel_milestones() TO service_role;
