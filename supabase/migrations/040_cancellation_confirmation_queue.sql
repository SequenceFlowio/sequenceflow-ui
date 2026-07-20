-- A provider action and its customer-facing confirmation are separate durable
-- steps. Replies stay blocked until a fresh, human-reviewed confirmation draft
-- has been generated from proven live provider state.

ALTER TABLE commerce_action_proposals
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_decision_id uuid REFERENCES support_decisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmation_error text,
  ADD COLUMN IF NOT EXISTS confirmation_processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_next_attempt_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_decisions_tenant_id
  ON support_decisions (tenant_id, id);

ALTER TABLE commerce_action_proposals
  DROP CONSTRAINT IF EXISTS commerce_actions_tenant_confirmation_decision_fk,
  ADD CONSTRAINT commerce_actions_tenant_confirmation_decision_fk
    FOREIGN KEY (tenant_id, confirmation_decision_id)
    REFERENCES support_decisions (tenant_id, id)
    ON DELETE SET NULL (confirmation_decision_id);

ALTER TABLE commerce_action_proposals
  DROP CONSTRAINT IF EXISTS commerce_actions_confirmation_status_check,
  ADD CONSTRAINT commerce_actions_confirmation_status_check
    CHECK (confirmation_status IN ('pending', 'preparing', 'prepared', 'failed'));

ALTER TABLE commerce_action_proposals
  DROP CONSTRAINT IF EXISTS commerce_actions_confirmation_attempts_check,
  ADD CONSTRAINT commerce_actions_confirmation_attempts_check
    CHECK (confirmation_attempts >= 0 AND confirmation_attempts <= 5);

CREATE INDEX IF NOT EXISTS idx_commerce_actions_confirmation_queue
  ON commerce_action_proposals (confirmation_next_attempt_at, completed_at)
  WHERE status = 'succeeded'
    AND confirmation_status IN ('pending', 'preparing', 'failed')
    AND confirmation_attempts < 5;

CREATE OR REPLACE FUNCTION claim_cancellation_confirmations(p_limit integer DEFAULT 1)
RETURNS TABLE (
  action_id uuid,
  tenant_id uuid,
  conversation_id uuid,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT proposal.id
    FROM commerce_action_proposals AS proposal
    WHERE proposal.action_type = 'cancel_order'
      AND proposal.status = 'succeeded'
      AND proposal.conversation_id IS NOT NULL
      AND proposal.confirmation_attempts < 5
      AND (
        (proposal.confirmation_status IN ('pending', 'failed')
          AND proposal.confirmation_next_attempt_at <= now())
        OR (proposal.confirmation_status = 'preparing'
          AND proposal.confirmation_processing_started_at < now() - interval '10 minutes')
      )
    ORDER BY proposal.confirmation_next_attempt_at, proposal.completed_at, proposal.created_at
    LIMIT LEAST(GREATEST(p_limit, 0), 20)
    FOR UPDATE OF proposal SKIP LOCKED
  ), claimed AS (
    UPDATE commerce_action_proposals AS proposal
    SET confirmation_status = 'preparing',
        confirmation_attempts = confirmation_attempts + 1,
        confirmation_processing_started_at = now(),
        confirmation_error = NULL,
        updated_at = now()
    FROM candidates
    WHERE proposal.id = candidates.id
    RETURNING proposal.id, proposal.tenant_id, proposal.conversation_id,
      proposal.confirmation_attempts
  )
  SELECT claimed.id, claimed.tenant_id, claimed.conversation_id, claimed.confirmation_attempts
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION claim_cancellation_confirmations(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_cancellation_confirmations(integer)
  TO service_role;
