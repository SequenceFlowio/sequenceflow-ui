ALTER TABLE pain_point_analyses
  ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS date_range_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sampled_ticket_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_version integer NOT NULL DEFAULT 2;

UPDATE pain_point_analyses
SET sampled_ticket_count = ticket_count
WHERE sampled_ticket_count = 0 AND ticket_count > 0;

UPDATE pain_point_analyses
SET pain_points = COALESCE((
  SELECT jsonb_agg(point - 'example')
  FROM jsonb_array_elements(pain_point_analyses.pain_points) AS point
), '[]'::jsonb);

UPDATE pain_point_analyses
SET analysis_version = 1
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(pain_point_analyses.pain_points) AS point
  WHERE NOT (point ? 'recommended_action')
);

DELETE FROM pain_point_analyses AS older
USING pain_point_analyses AS newer
WHERE older.tenant_id = newer.tenant_id
  AND older.period = newer.period
  AND (older.generated_at, older.id) < (newer.generated_at, newer.id);

ALTER TABLE pain_point_analyses
  DROP CONSTRAINT IF EXISTS pain_point_analyses_period_check,
  ADD CONSTRAINT pain_point_analyses_period_check
    CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly')),
  DROP CONSTRAINT IF EXISTS pain_point_analyses_counts_check,
  ADD CONSTRAINT pain_point_analyses_counts_check
    CHECK (ticket_count >= 0 AND sampled_ticket_count >= 0 AND sampled_ticket_count <= ticket_count);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pain_point_analyses_tenant_period
  ON pain_point_analyses (tenant_id, period);

COMMENT ON COLUMN pain_point_analyses.pain_points IS
  'Quote-free, pseudonymized aggregate pain points. Never store literal customer fragments.';
