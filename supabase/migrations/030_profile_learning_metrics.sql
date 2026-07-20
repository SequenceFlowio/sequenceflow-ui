CREATE OR REPLACE FUNCTION profile_learning_metrics(p_tenant_id uuid)
RETURNS TABLE (
  reviewed_decisions bigint,
  corrections bigint,
  correction_rate double precision,
  median_edit_distance double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH reviewed AS (
    SELECT count(*)::bigint AS total
    FROM support_decisions
    WHERE tenant_id = p_tenant_id
      AND review_status = 'sent'
      AND draft_body_ai IS NOT NULL
  ),
  learning AS (
    SELECT
      count(*) FILTER (WHERE edit_distance >= 0.03)::bigint AS corrected,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY edit_distance)::double precision AS median_distance
    FROM profile_learning_events
    WHERE tenant_id = p_tenant_id
      AND status <> 'processing'
  )
  SELECT
    reviewed.total,
    COALESCE(learning.corrected, 0),
    CASE WHEN reviewed.total > 0
      THEN COALESCE(learning.corrected, 0)::double precision / reviewed.total
      ELSE 0
    END,
    COALESCE(learning.median_distance, 0)
  FROM reviewed CROSS JOIN learning;
$$;
