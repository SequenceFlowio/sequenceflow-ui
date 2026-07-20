-- Remove PL/pgSQL output-column ambiguity from the learning queue claim.
CREATE OR REPLACE FUNCTION claim_profile_learning_decisions(p_limit integer DEFAULT 30)
RETURNS TABLE (
  event_id uuid,
  decision_id uuid,
  tenant_id uuid,
  draft_body_ai text,
  draft_body_original text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(100, GREATEST(0, COALESCE(p_limit, 30)));
BEGIN
  RETURN QUERY
  WITH stale_candidates AS (
    SELECT learning_event.id
    FROM profile_learning_events AS learning_event
    JOIN support_decisions AS support_decision
      ON support_decision.id = learning_event.decision_id
    WHERE learning_event.status IN ('processing', 'failed')
      AND learning_event.processed_at < now() - interval '10 minutes'
      AND support_decision.review_status = 'sent'
    ORDER BY learning_event.processed_at ASC
    LIMIT v_limit
    FOR UPDATE OF learning_event SKIP LOCKED
  ),
  stale AS (
    UPDATE profile_learning_events AS learning_event
      SET status = 'processing', processed_at = now(), error = NULL
    FROM stale_candidates AS claimed, support_decisions AS support_decision
    WHERE learning_event.id = claimed.id
      AND support_decision.id = learning_event.decision_id
    RETURNING learning_event.id, learning_event.decision_id, learning_event.tenant_id,
      support_decision.draft_body_ai, support_decision.draft_body_original
  ),
  candidates AS (
    SELECT support_decision.id, support_decision.tenant_id,
      support_decision.draft_body_ai, support_decision.draft_body_original
    FROM support_decisions AS support_decision
    WHERE support_decision.review_status = 'sent'
      AND support_decision.draft_body_ai IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM profile_learning_events AS existing_event
        WHERE existing_event.decision_id = support_decision.id
      )
    ORDER BY support_decision.updated_at ASC
    LIMIT GREATEST(0, v_limit - (SELECT count(*) FROM stale))
    FOR UPDATE OF support_decision SKIP LOCKED
  ),
  inserted AS (
    INSERT INTO profile_learning_events AS learning_event (
      tenant_id, decision_id, normalized_ai, normalized_human, normalized_diff,
      edit_distance, classification, confidence, status, processed_at
    )
    SELECT candidate.tenant_id, candidate.id, '', '', '{}'::jsonb,
      0, 'other', 0, 'processing', now()
    FROM candidates AS candidate
    ON CONFLICT ON CONSTRAINT profile_learning_events_decision_id_key DO NOTHING
    RETURNING learning_event.id, learning_event.decision_id, learning_event.tenant_id
  )
  SELECT stale.id, stale.decision_id, stale.tenant_id,
    stale.draft_body_ai, stale.draft_body_original
  FROM stale
  UNION ALL
  SELECT inserted.id, inserted.decision_id, inserted.tenant_id,
    support_decision.draft_body_ai, support_decision.draft_body_original
  FROM inserted
  JOIN support_decisions AS support_decision
    ON support_decision.id = inserted.decision_id
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION claim_profile_learning_decisions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_profile_learning_decisions(integer) TO service_role;
