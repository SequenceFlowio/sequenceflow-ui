-- Expire old action metadata without ever unblocking an active or explicitly
-- retained case. Deleting a proposal cascades its execution evidence only after
-- the case has become final and the 24-month retention window has elapsed.

CREATE OR REPLACE FUNCTION prune_expired_commerce_actions(p_cutoff timestamptz)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  WITH deleted AS (
    DELETE FROM commerce_action_proposals AS proposal
    WHERE proposal.created_at < p_cutoff
      AND NOT EXISTS (
        SELECT 1
        FROM support_conversations AS conversation
        WHERE conversation.id = proposal.conversation_id
          AND conversation.tenant_id = proposal.tenant_id
          AND (
            conversation.retention_exempt = true
            OR conversation.status NOT IN ('sent', 'closed', 'ignored', 'escalated', 'archived')
          )
      )
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION prune_expired_commerce_actions(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prune_expired_commerce_actions(timestamptz)
  TO service_role;
