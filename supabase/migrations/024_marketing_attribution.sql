-- Privacy-friendly first-party attribution. No email content, names, IPs, or
-- browser fingerprints are stored. Service-role access only.

CREATE TABLE IF NOT EXISTS marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL CHECK (event_name IN ('landing_view', 'cta_click', 'signup_completed')),
  session_id text NOT NULL,
  user_id uuid,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  path text NOT NULL,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  fbclid text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, event_name, path)
);

CREATE INDEX IF NOT EXISTS idx_marketing_events_created_at
  ON marketing_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_events_campaign
  ON marketing_events (utm_campaign, event_name, created_at DESC);

ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;
