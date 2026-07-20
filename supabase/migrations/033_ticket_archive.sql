-- Reversible ticket archiving. Archived mail remains readable and follows the
-- normal retention policy unless a user explicitly marks it for preservation.

ALTER TABLE support_conversations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_status text;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from_status text;

ALTER TABLE support_conversations
  DROP CONSTRAINT IF EXISTS support_conversations_status_check;

ALTER TABLE support_conversations
  ADD CONSTRAINT support_conversations_status_check
  CHECK (status IN ('open', 'review', 'pending_autosend', 'sent', 'escalated', 'ignored', 'closed', 'archived'));

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('draft', 'pending_autosend', 'approved', 'escalated', 'sent', 'ignored', 'archived'));

ALTER TABLE support_conversations
  ADD CONSTRAINT support_conversations_archive_state_check
  CHECK (
    (status = 'archived' AND archived_at IS NOT NULL AND archived_from_status IN ('open', 'review', 'sent', 'escalated', 'ignored', 'closed'))
    OR (status <> 'archived' AND archived_at IS NULL AND archived_from_status IS NULL)
  );

ALTER TABLE tickets
  ADD CONSTRAINT tickets_archive_state_check
  CHECK (
    (status = 'archived' AND archived_at IS NOT NULL AND archived_from_status IN ('draft', 'approved', 'sent', 'escalated', 'ignored'))
    OR (status <> 'archived' AND archived_at IS NULL AND archived_from_status IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_support_conversations_archived
  ON support_conversations (tenant_id, archived_at DESC)
  WHERE status = 'archived';

CREATE INDEX IF NOT EXISTS idx_tickets_archived
  ON tickets (tenant_id, archived_at DESC)
  WHERE status = 'archived';

CREATE OR REPLACE FUNCTION set_ticket_archived(
  p_tenant_id uuid,
  p_ticket_id uuid,
  p_actor_user_id uuid,
  p_archived boolean
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
    IF p_archived THEN
      IF conversation_row.status = 'archived' THEN
        RETURN 'conversation';
      END IF;

      IF conversation_row.latest_decision_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM support_decisions
        WHERE id = conversation_row.latest_decision_id
          AND tenant_id = p_tenant_id
          AND blocking_action_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Resolve the linked commerce action before archiving this ticket.';
      END IF;

      UPDATE support_conversations
      SET status = 'archived',
          archived_from_status = CASE WHEN conversation_row.status = 'pending_autosend' THEN 'review' ELSE conversation_row.status END,
          archived_at = now(),
          scheduled_send_at = NULL,
          updated_at = now()
      WHERE id = p_ticket_id AND tenant_id = p_tenant_id;
    ELSE
      IF conversation_row.status <> 'archived' THEN
        RETURN 'conversation';
      END IF;

      restored_status := CASE
        WHEN conversation_row.archived_from_status IN ('open', 'review', 'sent', 'escalated', 'ignored', 'closed')
          THEN conversation_row.archived_from_status
        ELSE 'review'
      END;
      UPDATE support_conversations
      SET status = restored_status,
          archived_from_status = NULL,
          archived_at = NULL,
          updated_at = now()
      WHERE id = p_ticket_id AND tenant_id = p_tenant_id;
    END IF;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (p_tenant_id, 'manual', 'ticket_archive', 1, CASE WHEN p_archived THEN 'archived' ELSE 'restored' END);
    RETURN 'conversation';
  END IF;

  SELECT * INTO legacy_row
  FROM tickets
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    IF p_archived THEN
      IF legacy_row.status = 'archived' THEN
        RETURN 'legacy';
      END IF;

      UPDATE tickets
      SET status = 'archived',
          archived_from_status = CASE WHEN legacy_row.status = 'pending_autosend' THEN 'draft' ELSE legacy_row.status END,
          archived_at = now(),
          scheduled_send_at = NULL,
          updated_at = now()
      WHERE id = p_ticket_id AND tenant_id = p_tenant_id;
    ELSE
      IF legacy_row.status <> 'archived' THEN
        RETURN 'legacy';
      END IF;

      restored_status := CASE
        WHEN legacy_row.archived_from_status IN ('draft', 'approved', 'sent', 'escalated', 'ignored')
          THEN legacy_row.archived_from_status
        ELSE 'draft'
      END;
      UPDATE tickets
      SET status = restored_status,
          archived_from_status = NULL,
          archived_at = NULL,
          updated_at = now()
      WHERE id = p_ticket_id AND tenant_id = p_tenant_id;
    END IF;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (p_tenant_id, 'manual', 'ticket_archive', 1, CASE WHEN p_archived THEN 'archived' ELSE 'restored' END);
    RETURN 'legacy';
  END IF;

  RAISE EXCEPTION 'Ticket not found.';
END;
$$;

REVOKE ALL ON FUNCTION set_ticket_archived(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_ticket_archived(uuid, uuid, uuid, boolean)
  TO service_role;

-- "Not relevant" now archives the current ticket while optionally blocking
-- future mail. This keeps the current message available for later inspection.
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
  legacy_row tickets%ROWTYPE;
  normalized_sender text;
BEGIN
  SELECT * INTO conversation_row
  FROM support_conversations
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    IF conversation_row.latest_decision_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM support_decisions
      WHERE id = conversation_row.latest_decision_id
        AND tenant_id = p_tenant_id
        AND blocking_action_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Resolve the linked commerce action before archiving this ticket.';
    END IF;

    normalized_sender := lower(btrim(conversation_row.customer_email));
    IF p_block_future THEN
      INSERT INTO tenant_sender_filters (tenant_id, email, created_by)
      VALUES (p_tenant_id, normalized_sender, p_actor_user_id)
      ON CONFLICT (tenant_id, email) DO NOTHING;
    END IF;

    UPDATE support_conversations
    SET status = 'archived',
        archived_from_status = CASE WHEN conversation_row.status = 'pending_autosend' THEN 'review' ELSE conversation_row.status END,
        archived_at = now(),
        scheduled_send_at = NULL,
        updated_at = now()
    WHERE id = p_ticket_id AND tenant_id = p_tenant_id;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (p_tenant_id, 'manual', 'sender_filter', 1,
      CASE WHEN p_block_future THEN 'manual_archive_and_block_sender' ELSE 'manual_archive' END);
    RETURN 'conversation';
  END IF;

  SELECT * INTO legacy_row
  FROM tickets
  WHERE id = p_ticket_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF FOUND THEN
    normalized_sender := lower(btrim(legacy_row.from_email));
    IF p_block_future THEN
      INSERT INTO tenant_sender_filters (tenant_id, email, created_by)
      VALUES (p_tenant_id, normalized_sender, p_actor_user_id)
      ON CONFLICT (tenant_id, email) DO NOTHING;
    END IF;

    UPDATE tickets
    SET status = 'archived',
        archived_from_status = CASE WHEN legacy_row.status = 'pending_autosend' THEN 'draft' ELSE legacy_row.status END,
        archived_at = now(),
        scheduled_send_at = NULL,
        updated_at = now()
    WHERE id = p_ticket_id AND tenant_id = p_tenant_id;

    INSERT INTO support_events (tenant_id, source, intent, confidence, outcome)
    VALUES (p_tenant_id, 'manual', 'sender_filter', 1,
      CASE WHEN p_block_future THEN 'manual_archive_and_block_sender' ELSE 'manual_archive' END);
    RETURN 'legacy';
  END IF;

  RAISE EXCEPTION 'Ticket not found.';
END;
$$;

REVOKE ALL ON FUNCTION ignore_support_ticket(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ignore_support_ticket(uuid, uuid, uuid, boolean)
  TO service_role;
