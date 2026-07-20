-- Durable, retryable commerce webhook processing.

ALTER TABLE commerce_events
  DROP CONSTRAINT IF EXISTS commerce_events_status_check;
ALTER TABLE commerce_events
  ADD CONSTRAINT commerce_events_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'failed'));

ALTER TABLE commerce_events
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();

UPDATE commerce_events
SET next_attempt_at = now()
WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_commerce_events_retry_queue
  ON commerce_events (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed', 'processing') AND attempts < 10;

CREATE OR REPLACE FUNCTION claim_commerce_events(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  connection_id uuid,
  provider_event_id text,
  topic text,
  event_data jsonb,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT event.id
    FROM commerce_events AS event
    WHERE event.attempts < 10
      AND (
        (event.status IN ('pending', 'failed') AND event.next_attempt_at <= now())
        OR (event.status = 'processing' AND event.processing_started_at < now() - interval '10 minutes')
      )
    ORDER BY event.next_attempt_at ASC, event.created_at ASC
    LIMIT LEAST(GREATEST(p_limit, 0), 100)
    FOR UPDATE OF event SKIP LOCKED
  ), claimed AS (
    UPDATE commerce_events AS event
    SET status = 'processing',
        processing_started_at = now(),
        error = NULL
    FROM candidates
    WHERE event.id = candidates.id
    RETURNING event.id, event.tenant_id, event.connection_id,
      event.provider_event_id, event.topic, event.event_data, event.attempts
  )
  SELECT claimed.id, claimed.tenant_id, claimed.connection_id,
    claimed.provider_event_id, claimed.topic, claimed.event_data, claimed.attempts
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION claim_commerce_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_commerce_events(integer) TO service_role;
