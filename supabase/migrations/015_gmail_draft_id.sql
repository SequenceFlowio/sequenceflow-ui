-- Add gmail_draft_id to tickets so we can delete the Gmail draft after sending
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS gmail_draft_id text;
