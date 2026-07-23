ALTER TABLE support_conversations
  DROP CONSTRAINT IF EXISTS support_conversations_status_check;
ALTER TABLE support_conversations
  ADD CONSTRAINT support_conversations_status_check
  CHECK (status IN ('open', 'review', 'pending_autosend', 'sent', 'escalated', 'ignored', 'closed', 'archived', 'spam'));

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('draft', 'pending_autosend', 'approved', 'escalated', 'sent', 'ignored', 'archived', 'spam'));

ALTER TABLE support_conversations
  ADD COLUMN IF NOT EXISTS spammed_at timestamptz,
  ADD COLUMN IF NOT EXISTS spammed_from_status text;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS spammed_at timestamptz,
  ADD COLUMN IF NOT EXISTS spammed_from_status text;

ALTER TABLE support_conversations
  DROP CONSTRAINT IF EXISTS support_conversations_spam_state_check;
ALTER TABLE support_conversations
  ADD CONSTRAINT support_conversations_spam_state_check CHECK (
    (status = 'spam' AND spammed_at IS NOT NULL)
    OR
    (status <> 'spam' AND spammed_at IS NULL AND spammed_from_status IS NULL)
  );

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_spam_state_check;
ALTER TABLE tickets
  ADD CONSTRAINT tickets_spam_state_check CHECK (
    (status = 'spam' AND spammed_at IS NOT NULL)
    OR
    (status <> 'spam' AND spammed_at IS NULL AND spammed_from_status IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_support_conversations_spam
  ON support_conversations (tenant_id, spammed_at DESC)
  WHERE status = 'spam';

CREATE INDEX IF NOT EXISTS idx_tickets_spam
  ON tickets (tenant_id, spammed_at DESC)
  WHERE status = 'spam';

ALTER TABLE tenant_sender_filters
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'spam_feedback')),
  ADD COLUMN IF NOT EXISTS source_ticket_id uuid;

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid,
  legacy_ticket_id uuid,
  decision_id uuid,
  original_usage_event_id uuid REFERENCES ai_usage_events(id) ON DELETE SET NULL,
  operation text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  cached_input_tokens integer NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  weighted_tokens integer NOT NULL DEFAULT 0 CHECK (weighted_tokens >= 0),
  credit_delta integer NOT NULL DEFAULT 0,
  billing_status text NOT NULL
    CHECK (billing_status IN ('charged', 'waived', 'refunded', 'recharged')),
  reason text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_period
  ON ai_usage_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_conversation
  ON ai_usage_events (tenant_id, conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_compensation_once
  ON ai_usage_events (original_usage_event_id, operation)
  WHERE original_usage_event_id IS NOT NULL;

ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON ai_usage_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id
      FROM tenant_members
      WHERE user_id = (SELECT auth.uid())
      LIMIT 1
    )
  );

CREATE TABLE IF NOT EXISTS spam_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES support_conversations(id) ON DELETE SET NULL,
  legacy_ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_key text,
  source text NOT NULL CHECK (source IN ('human', 'prefilter', 'agent')),
  human_label text NOT NULL CHECK (human_label IN ('spam', 'not_spam')),
  previous_status text,
  block_future boolean NOT NULL DEFAULT false,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spam_feedback_tenant
  ON spam_feedback_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spam_feedback_sender
  ON spam_feedback_events (tenant_id, sender_key, created_at DESC)
  WHERE sender_key IS NOT NULL;

ALTER TABLE spam_feedback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON spam_feedback_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id
      FROM tenant_members
      WHERE user_id = (SELECT auth.uid())
      LIMIT 1
    )
  );

CREATE OR REPLACE FUNCTION refund_conversation_ai_usage(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_reason text DEFAULT 'spam'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  refunded_count integer;
BEGIN
  INSERT INTO ai_usage_events (
    tenant_id,
    conversation_id,
    decision_id,
    original_usage_event_id,
    operation,
    model,
    prompt_tokens,
    cached_input_tokens,
    completion_tokens,
    weighted_tokens,
    credit_delta,
    billing_status,
    reason,
    idempotency_key
  )
  SELECT
    usage.tenant_id,
    usage.conversation_id,
    usage.decision_id,
    usage.id,
    'spam_refund',
    usage.model,
    0,
    0,
    0,
    usage.weighted_tokens,
    -usage.credit_delta,
    'refunded',
    p_reason,
    'spam-refund:' || usage.id::text
  FROM ai_usage_events usage
  WHERE usage.tenant_id = p_tenant_id
    AND usage.conversation_id = p_conversation_id
    AND usage.billing_status IN ('charged', 'recharged')
    AND usage.credit_delta > 0
    AND NOT EXISTS (
      SELECT 1
      FROM ai_usage_events compensation
      WHERE compensation.original_usage_event_id = usage.id
        AND compensation.operation = 'spam_refund'
    )
  ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

  GET DIAGNOSTICS refunded_count = ROW_COUNT;
  RETURN refunded_count;
END;
$$;

CREATE OR REPLACE FUNCTION mark_ticket_spam(
  p_tenant_id uuid,
  p_ticket_id uuid,
  p_actor_user_id uuid,
  p_sender_key text DEFAULT NULL,
  p_block_future boolean DEFAULT false,
  p_refund_eligible boolean DEFAULT true,
  p_refund_reason text DEFAULT 'automatic_spam_refund'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conversation_row support_conversations%ROWTYPE;
  legacy_row tickets%ROWTYPE;
  normalized_sender text;
BEGIN
  SELECT * INTO conversation_row
  FROM support_conversations
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    IF conversation_row.status = 'spam' THEN
      RETURN 'conversation';
    END IF;
    IF conversation_row.status IN ('sent', 'escalated', 'closed') THEN
      RAISE EXCEPTION 'Handled tickets cannot be marked as spam.';
    END IF;
    IF conversation_row.latest_decision_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM support_decisions
      WHERE id = conversation_row.latest_decision_id
        AND tenant_id = p_tenant_id
        AND blocking_action_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Resolve the linked commerce action before marking this ticket as spam.';
    END IF;

    normalized_sender := lower(btrim(conversation_row.customer_email));
    IF p_block_future THEN
      INSERT INTO tenant_sender_filters (tenant_id, email, created_by, source, source_ticket_id)
      VALUES (p_tenant_id, normalized_sender, p_actor_user_id, 'spam_feedback', p_ticket_id)
      ON CONFLICT (tenant_id, email) DO NOTHING;
    END IF;

    UPDATE support_conversations
    SET status = 'spam',
        spammed_from_status = CASE
          WHEN conversation_row.status IN ('open', 'review', 'pending_autosend', 'ignored', 'archived') THEN conversation_row.status
          ELSE 'review'
        END,
        spammed_at = now(),
        archived_at = NULL,
        archived_from_status = NULL,
        scheduled_send_at = NULL,
        updated_at = now()
    WHERE id = p_ticket_id AND tenant_id = p_tenant_id;

    IF conversation_row.latest_decision_id IS NOT NULL THEN
      UPDATE support_decisions
      SET review_status = 'ignored', updated_at = now()
      WHERE id = conversation_row.latest_decision_id AND tenant_id = p_tenant_id;
    END IF;

    INSERT INTO spam_feedback_events (
      tenant_id, conversation_id, actor_user_id, sender_key,
      source, human_label, previous_status, block_future, metadata
    )
    VALUES (
      p_tenant_id, p_ticket_id, p_actor_user_id, p_sender_key,
      'human', 'spam', conversation_row.status, p_block_future,
      jsonb_build_object('refund_eligible', p_refund_eligible, 'refund_reason', p_refund_reason)
    );

    IF p_refund_eligible
      AND NOT EXISTS (
        SELECT 1
        FROM support_messages
        WHERE tenant_id = p_tenant_id
          AND conversation_id = p_ticket_id
          AND direction = 'outbound'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM support_decisions
        WHERE tenant_id = p_tenant_id
          AND conversation_id = p_ticket_id
          AND draft_body_ai IS NOT NULL
          AND draft_body_original IS DISTINCT FROM draft_body_ai
      )
    THEN
      PERFORM refund_conversation_ai_usage(p_tenant_id, p_ticket_id, 'human_marked_spam');
    END IF;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (
      p_tenant_id, 'manual', 'spam_feedback', 1,
      CASE WHEN p_block_future THEN 'manual_spam_and_block_sender' ELSE 'manual_spam' END
    );
    RETURN 'conversation';
  END IF;

  SELECT * INTO legacy_row
  FROM tickets
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    IF legacy_row.status = 'spam' THEN
      RETURN 'legacy';
    END IF;
    IF legacy_row.status IN ('sent', 'escalated') THEN
      RAISE EXCEPTION 'Handled tickets cannot be marked as spam.';
    END IF;

    normalized_sender := lower(btrim(legacy_row.from_email));
    IF p_block_future THEN
      INSERT INTO tenant_sender_filters (tenant_id, email, created_by, source, source_ticket_id)
      VALUES (p_tenant_id, normalized_sender, p_actor_user_id, 'spam_feedback', p_ticket_id)
      ON CONFLICT (tenant_id, email) DO NOTHING;
    END IF;

    UPDATE tickets
    SET status = 'spam',
        spammed_from_status = CASE
          WHEN legacy_row.status IN ('draft', 'pending_autosend', 'approved', 'ignored', 'archived') THEN legacy_row.status
          ELSE 'draft'
        END,
        spammed_at = now(),
        archived_at = NULL,
        archived_from_status = NULL,
        scheduled_send_at = NULL,
        updated_at = now()
    WHERE id = p_ticket_id AND tenant_id = p_tenant_id;

    INSERT INTO spam_feedback_events (
      tenant_id, legacy_ticket_id, actor_user_id, sender_key,
      source, human_label, previous_status, block_future, metadata
    )
    VALUES (
      p_tenant_id, p_ticket_id, p_actor_user_id, p_sender_key,
      'human', 'spam', legacy_row.status, p_block_future,
      jsonb_build_object('refund_eligible', p_refund_eligible, 'refund_reason', p_refund_reason)
    );

    IF p_refund_eligible THEN
      INSERT INTO ai_usage_events (
      tenant_id,
      legacy_ticket_id,
      original_usage_event_id,
      operation,
      model,
      weighted_tokens,
      credit_delta,
      billing_status,
      reason,
      idempotency_key
    )
    SELECT
      usage.tenant_id,
      usage.legacy_ticket_id,
      usage.id,
      'spam_refund',
      usage.model,
      usage.weighted_tokens,
      -usage.credit_delta,
      'refunded',
      'human_marked_spam',
      'spam-refund:' || usage.id::text
    FROM ai_usage_events usage
    WHERE usage.tenant_id = p_tenant_id
      AND usage.legacy_ticket_id = p_ticket_id
      AND usage.billing_status IN ('charged', 'recharged')
      AND usage.credit_delta > 0
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
    END IF;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (
      p_tenant_id, 'manual', 'spam_feedback', 1,
      CASE WHEN p_block_future THEN 'manual_spam_and_block_sender' ELSE 'manual_spam' END
    );
    RETURN 'legacy';
  END IF;

  RAISE EXCEPTION 'Ticket not found.';
END;
$$;

CREATE OR REPLACE FUNCTION restore_ticket_from_spam(
  p_tenant_id uuid,
  p_ticket_id uuid,
  p_actor_user_id uuid,
  p_sender_key text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conversation_row support_conversations%ROWTYPE;
  legacy_row tickets%ROWTYPE;
  restored_status text;
BEGIN
  SELECT * INTO conversation_row
  FROM support_conversations
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    IF conversation_row.status <> 'spam' THEN
      RAISE EXCEPTION 'Ticket is not marked as spam.';
    END IF;

    restored_status := CASE
      WHEN conversation_row.spammed_from_status IN ('open', 'review', 'ignored') THEN conversation_row.spammed_from_status
      ELSE 'review'
    END;

    UPDATE support_conversations
    SET status = restored_status,
        spammed_at = NULL,
        spammed_from_status = NULL,
        updated_at = now()
    WHERE id = p_ticket_id AND tenant_id = p_tenant_id;

    DELETE FROM tenant_sender_filters
    WHERE tenant_id = p_tenant_id
      AND source = 'spam_feedback'
      AND source_ticket_id = p_ticket_id;

    IF conversation_row.latest_decision_id IS NOT NULL THEN
      UPDATE support_decisions
      SET review_status = 'pending_review', updated_at = now()
      WHERE id = conversation_row.latest_decision_id AND tenant_id = p_tenant_id;
    END IF;

    INSERT INTO spam_feedback_events (
      tenant_id, conversation_id, actor_user_id, sender_key,
      source, human_label, previous_status
    )
    VALUES (
      p_tenant_id, p_ticket_id, p_actor_user_id, p_sender_key,
      'human', 'not_spam', 'spam'
    );

    INSERT INTO ai_usage_events (
      tenant_id,
      conversation_id,
      decision_id,
      original_usage_event_id,
      operation,
      model,
      weighted_tokens,
      credit_delta,
      billing_status,
      reason,
      idempotency_key
    )
    SELECT
      refund.tenant_id,
      refund.conversation_id,
      refund.decision_id,
      refund.id,
      'spam_restore',
      refund.model,
      refund.weighted_tokens,
      -refund.credit_delta,
      'recharged',
      'human_restored_not_spam',
      'spam-restore:' || refund.id::text
    FROM ai_usage_events refund
    WHERE refund.tenant_id = p_tenant_id
      AND refund.conversation_id = p_ticket_id
      AND refund.operation = 'spam_refund'
      AND refund.credit_delta < 0
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (p_tenant_id, 'manual', 'spam_feedback', 1, 'manual_not_spam');
    RETURN 'conversation';
  END IF;

  SELECT * INTO legacy_row
  FROM tickets
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    IF legacy_row.status <> 'spam' THEN
      RAISE EXCEPTION 'Ticket is not marked as spam.';
    END IF;

    restored_status := CASE
      WHEN legacy_row.spammed_from_status IN ('draft', 'approved', 'ignored') THEN legacy_row.spammed_from_status
      ELSE 'draft'
    END;

    UPDATE tickets
    SET status = restored_status,
        spammed_at = NULL,
        spammed_from_status = NULL,
        updated_at = now()
    WHERE id = p_ticket_id AND tenant_id = p_tenant_id;

    DELETE FROM tenant_sender_filters
    WHERE tenant_id = p_tenant_id
      AND source = 'spam_feedback'
      AND source_ticket_id = p_ticket_id;

    INSERT INTO spam_feedback_events (
      tenant_id, legacy_ticket_id, actor_user_id, sender_key,
      source, human_label, previous_status
    )
    VALUES (
      p_tenant_id, p_ticket_id, p_actor_user_id, p_sender_key,
      'human', 'not_spam', 'spam'
    );

    INSERT INTO ai_usage_events (
      tenant_id,
      legacy_ticket_id,
      original_usage_event_id,
      operation,
      model,
      weighted_tokens,
      credit_delta,
      billing_status,
      reason,
      idempotency_key
    )
    SELECT
      refund.tenant_id,
      refund.legacy_ticket_id,
      refund.id,
      'spam_restore',
      refund.model,
      refund.weighted_tokens,
      -refund.credit_delta,
      'recharged',
      'human_restored_not_spam',
      'spam-restore:' || refund.id::text
    FROM ai_usage_events refund
    WHERE refund.tenant_id = p_tenant_id
      AND refund.legacy_ticket_id = p_ticket_id
      AND refund.operation = 'spam_refund'
      AND refund.credit_delta < 0
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (p_tenant_id, 'manual', 'spam_feedback', 1, 'manual_not_spam');
    RETURN 'legacy';
  END IF;

  RAISE EXCEPTION 'Ticket not found.';
END;
$$;

REVOKE ALL ON FUNCTION refund_conversation_ai_usage(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refund_conversation_ai_usage(uuid, uuid, text)
  TO service_role;

REVOKE ALL ON FUNCTION mark_ticket_spam(uuid, uuid, uuid, text, boolean, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_ticket_spam(uuid, uuid, uuid, text, boolean, boolean, text)
  TO service_role;

REVOKE ALL ON FUNCTION restore_ticket_from_spam(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION restore_ticket_from_spam(uuid, uuid, uuid, text)
  TO service_role;
