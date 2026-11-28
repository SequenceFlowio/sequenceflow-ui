-- Opvolging van proefaccounts (backoffice, tab Opvolging): persoonlijke mails van
-- Navaron op dag 2, 7 en 12 van de proef. Ze worden als concept klaargezet en pas
-- verstuurd als een beheerder op Versturen klikt. Alleen de service-role.

CREATE TABLE IF NOT EXISTS trial_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step smallint NOT NULL CHECK (step IN (2, 7, 12)),
  variant text NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'concept' CHECK (status IN ('concept', 'verstuurd', 'overgeslagen')),
  to_email text,
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz,
  sent_by text,
  resend_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, step)
);

CREATE INDEX IF NOT EXISTS idx_trial_followups_status_due ON trial_followups (status, due_at);

ALTER TABLE trial_followups ENABLE ROW LEVEL SECURITY;
