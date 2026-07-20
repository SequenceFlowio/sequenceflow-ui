-- Remove support content from analytics rows created by older application code.
-- Operational email content remains in ticket/conversation tables under their
-- separate retention policy.

UPDATE support_events
SET subject = NULL,
    draft_text = NULL
WHERE subject IS NOT NULL OR draft_text IS NOT NULL;

ALTER TABLE marketing_events
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS fbclid text;

COMMENT ON COLUMN support_events.subject IS 'Deprecated: content must not be stored in analytics events.';
COMMENT ON COLUMN support_events.draft_text IS 'Deprecated: content must not be stored in analytics events.';
COMMENT ON COLUMN tenants.plan IS 'Allowed values: trial, starter, pro, agency, custom, expired';
