-- Tenant-managed exact sender blocklist. Existing mail is retained unless an
-- agent explicitly ignores a ticket through the transactional RPC below.

CREATE TABLE IF NOT EXISTS tenant_sender_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_sender_filters_normalized_email CHECK (
    email = lower(btrim(email))
    AND length(email) BETWEEN 3 AND 254
    AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_tenant_sender_filters_lookup
  ON tenant_sender_filters (tenant_id, email);

ALTER TABLE tenant_sender_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON tenant_sender_filters
  FOR SELECT TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = (SELECT auth.uid())
      LIMIT 1
    )
  );

CREATE OR REPLACE FUNCTION ignore_support_ticket(
  p_tenant_id uuid,
  p_ticket_id uuid,
  p_actor_user_id uuid,
  p_block_future boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conversation_row support_conversations%ROWTYPE;
  legacy_sender text;
  normalized_sender text;
BEGIN
  SELECT * INTO conversation_row
  FROM support_conversations
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    IF conversation_row.latest_decision_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM support_decisions
      WHERE id = conversation_row.latest_decision_id
        AND tenant_id = p_tenant_id
        AND blocking_action_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Resolve the linked commerce action before ignoring this ticket.';
    END IF;

    normalized_sender := lower(btrim(conversation_row.customer_email));
    IF p_block_future THEN
      INSERT INTO tenant_sender_filters (tenant_id, email, created_by)
      VALUES (p_tenant_id, normalized_sender, p_actor_user_id)
      ON CONFLICT (tenant_id, email) DO NOTHING;
    END IF;

    UPDATE support_conversations
    SET status = 'ignored', scheduled_send_at = NULL, updated_at = now()
    WHERE id = p_ticket_id AND tenant_id = p_tenant_id;

    IF conversation_row.latest_decision_id IS NOT NULL THEN
      UPDATE support_decisions
      SET review_status = 'ignored', updated_at = now()
      WHERE id = conversation_row.latest_decision_id AND tenant_id = p_tenant_id;
    END IF;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (
      p_tenant_id, 'manual', 'sender_filter', 1,
      CASE WHEN p_block_future THEN 'manual_ignore_and_block_sender' ELSE 'manual_ignore' END
    );
    RETURN 'conversation';
  END IF;

  SELECT lower(btrim(from_email)) INTO legacy_sender
  FROM tickets
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF legacy_sender IS NOT NULL THEN
    IF p_block_future THEN
      INSERT INTO tenant_sender_filters (tenant_id, email, created_by)
      VALUES (p_tenant_id, legacy_sender, p_actor_user_id)
      ON CONFLICT (tenant_id, email) DO NOTHING;
    END IF;

    UPDATE tickets
    SET status = 'ignored', scheduled_send_at = NULL, updated_at = now()
    WHERE id = p_ticket_id AND tenant_id = p_tenant_id;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (
      p_tenant_id, 'manual', 'sender_filter', 1,
      CASE WHEN p_block_future THEN 'manual_ignore_and_block_sender' ELSE 'manual_ignore' END
    );
    RETURN 'legacy';
  END IF;

  RAISE EXCEPTION 'Ticket not found.';
END;
$$;

REVOKE ALL ON FUNCTION ignore_support_ticket(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ignore_support_ticket(uuid, uuid, uuid, boolean)
  TO service_role;
