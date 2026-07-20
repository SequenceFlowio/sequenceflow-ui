-- Remove normalized order PII after the operational case no longer needs it.
DELETE FROM mined_exchanges;

UPDATE mining_jobs
SET status = 'failed',
    error = 'Restart mining after privacy hardening.',
    updated_at = now()
WHERE status IN ('queued', 'running', 'distilling');

DELETE FROM tenant_profile_facts
WHERE origin = 'mining' AND kind = 'exemplar';

UPDATE tenant_profile_facts
SET source_refs = NULL,
    updated_at = now()
WHERE origin = 'mining' AND source_refs IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_retention
  ON commerce_orders ((COALESCE(provider_updated_at, order_created_at)));

CREATE INDEX IF NOT EXISTS idx_commerce_actions_order_open
  ON commerce_action_proposals (order_id, status)
  WHERE order_id IS NOT NULL
    AND status IN ('proposed', 'approved', 'executing', 'failed', 'blocked');

CREATE OR REPLACE FUNCTION prune_expired_commerce_orders(p_cutoff timestamptz)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  WITH deleted AS (
    DELETE FROM commerce_orders AS order_record
    WHERE COALESCE(order_record.provider_updated_at, order_record.order_created_at) < p_cutoff
      AND NOT EXISTS (
        SELECT 1
        FROM conversation_entity_links AS entity_link
        JOIN support_conversations AS conversation
          ON conversation.id = entity_link.conversation_id
         AND conversation.tenant_id = order_record.tenant_id
        WHERE entity_link.order_id = order_record.id
          AND entity_link.tenant_id = order_record.tenant_id
          AND (
            conversation.retention_exempt = true
            OR conversation.latest_message_at >= p_cutoff
            OR conversation.status NOT IN ('sent', 'closed', 'ignored', 'escalated', 'archived')
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM commerce_action_proposals AS proposal
        WHERE proposal.order_id = order_record.id
          AND proposal.tenant_id = order_record.tenant_id
          AND proposal.status IN ('proposed', 'approved', 'executing', 'failed', 'blocked')
      )
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION prune_expired_commerce_orders(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prune_expired_commerce_orders(timestamptz)
  TO service_role;
