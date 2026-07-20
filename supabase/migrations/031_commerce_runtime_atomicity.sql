-- Keep action state, execution evidence, and lifecycle outcomes in one transaction.

WITH duplicate_outcomes AS (
  SELECT id,
    row_number() OVER (PARTITION BY action_id, outcome_type ORDER BY occurred_at, id) AS position
  FROM operational_outcomes
  WHERE action_id IS NOT NULL
    AND outcome_type IN ('action_proposed', 'action_approved', 'action_rejected', 'action_succeeded', 'action_failed')
)
DELETE FROM operational_outcomes
WHERE id IN (SELECT id FROM duplicate_outcomes WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_action_lifecycle_once
  ON operational_outcomes (action_id, outcome_type)
  WHERE action_id IS NOT NULL
    AND outcome_type IN ('action_proposed', 'action_approved', 'action_rejected', 'action_succeeded', 'action_failed');

CREATE OR REPLACE FUNCTION record_action_lifecycle_outcome()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  lifecycle_type text;
  lifecycle_metadata jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  lifecycle_type := CASE NEW.status
    WHEN 'approved' THEN 'action_approved'
    WHEN 'rejected' THEN 'action_rejected'
    WHEN 'succeeded' THEN 'action_succeeded'
    WHEN 'failed' THEN 'action_failed'
    WHEN 'blocked' THEN 'action_failed'
    ELSE NULL
  END;

  IF lifecycle_type IS NULL THEN
    RETURN NEW;
  END IF;

  lifecycle_metadata := jsonb_strip_nulls(jsonb_build_object(
    'status', NEW.status,
    'approvedBy', CASE WHEN NEW.status = 'approved' THEN NEW.approved_by ELSE NULL END,
    'error', CASE WHEN NEW.status IN ('failed', 'blocked') THEN NEW.last_error ELSE NULL END
  ));

  INSERT INTO operational_outcomes (
    tenant_id, conversation_id, order_id, action_id, outcome_type, metadata
  ) VALUES (
    NEW.tenant_id, NEW.conversation_id, NEW.order_id, NEW.id, lifecycle_type, lifecycle_metadata
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commerce_action_lifecycle_outcome ON commerce_action_proposals;
CREATE TRIGGER commerce_action_lifecycle_outcome
  AFTER UPDATE OF status ON commerce_action_proposals
  FOR EACH ROW EXECUTE FUNCTION record_action_lifecycle_outcome();

CREATE OR REPLACE FUNCTION finalize_commerce_action_execution(
  p_tenant_id uuid,
  p_proposal_id uuid,
  p_execution_id uuid,
  p_execution_status text,
  p_response_data jsonb DEFAULT '{}'::jsonb,
  p_provider_job_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proposal_status text;
BEGIN
  IF p_execution_status NOT IN ('provider_pending', 'succeeded', 'failed') THEN
    RAISE EXCEPTION 'Unsupported execution status.' USING ERRCODE = '22023';
  END IF;

  PERFORM id
  FROM commerce_action_executions
  WHERE id = p_execution_id
    AND proposal_id = p_proposal_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commerce action execution not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM id
  FROM commerce_action_proposals
  WHERE id = p_proposal_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commerce action proposal not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE commerce_action_executions
  SET status = p_execution_status,
      response_data = COALESCE(p_response_data, '{}'::jsonb),
      provider_job_id = COALESCE(p_provider_job_id, provider_job_id),
      error = p_error,
      completed_at = CASE WHEN p_execution_status = 'provider_pending' THEN NULL ELSE now() END
  WHERE id = p_execution_id;

  proposal_status := CASE p_execution_status
    WHEN 'provider_pending' THEN 'executing'
    WHEN 'succeeded' THEN 'succeeded'
    ELSE 'failed'
  END;

  UPDATE commerce_action_proposals
  SET status = proposal_status,
      completed_at = CASE WHEN proposal_status = 'succeeded' THEN now() ELSE NULL END,
      last_error = CASE WHEN proposal_status = 'succeeded' THEN NULL ELSE p_error END,
      updated_at = now()
  WHERE id = p_proposal_id
    AND tenant_id = p_tenant_id;

  RETURN proposal_status;
END;
$$;

REVOKE ALL ON FUNCTION finalize_commerce_action_execution(uuid, uuid, uuid, text, jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION finalize_commerce_action_execution(uuid, uuid, uuid, text, jsonb, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION confirm_conversation_order_link(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_order_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_id uuid;
BEGIN
  PERFORM id FROM support_conversations
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM id FROM commerce_orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM conversation_entity_links
  WHERE tenant_id = p_tenant_id AND conversation_id = p_conversation_id;

  INSERT INTO conversation_entity_links (
    tenant_id, conversation_id, order_id, link_status, match_method,
    confidence, evidence, confirmed_by, confirmed_at
  ) VALUES (
    p_tenant_id, p_conversation_id, p_order_id, 'linked', 'manual',
    1, '{"selectedInTicket": true}'::jsonb, p_user_id, now()
  )
  RETURNING id INTO linked_id;

  RETURN linked_id;
END;
$$;

REVOKE ALL ON FUNCTION confirm_conversation_order_link(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_conversation_order_link(uuid, uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION reject_commerce_action(
  p_tenant_id uuid,
  p_action_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_id uuid;
BEGIN
  UPDATE commerce_action_proposals
  SET status = 'rejected', updated_at = now()
  WHERE id = p_action_id
    AND tenant_id = p_tenant_id
    AND status IN ('proposed', 'failed', 'blocked')
  RETURNING id INTO changed_id;

  IF changed_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE support_decisions
  SET blocking_action_id = NULL, updated_at = now()
  WHERE blocking_action_id = p_action_id
    AND tenant_id = p_tenant_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION reject_commerce_action(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reject_commerce_action(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION profile_learning_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION profile_learning_metrics(uuid) TO service_role;
