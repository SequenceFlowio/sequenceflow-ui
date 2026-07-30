CREATE TABLE IF NOT EXISTS commerce_intelligence_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_days integer NOT NULL CHECK (period_days IN (7, 30, 90)),
  input_hash text NOT NULL CHECK (length(input_hash) = 64),
  analysis_version integer NOT NULL DEFAULT 1 CHECK (analysis_version > 0),
  source_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  briefing jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_days)
);

CREATE INDEX IF NOT EXISTS idx_commerce_intelligence_briefings_tenant_generated
  ON commerce_intelligence_briefings (tenant_id, generated_at DESC);

ALTER TABLE commerce_intelligence_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select" ON commerce_intelligence_briefings;
CREATE POLICY "tenant_select" ON commerce_intelligence_briefings
  FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id
      FROM tenant_members
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

COMMENT ON TABLE commerce_intelligence_briefings IS
  'Cached, aggregate-only commerce briefings. Contains no raw customer messages or customer identifiers.';
