-- Leadmachine (backoffice, tab Leads): Nederlandse webshops die we persoonlijk benaderen.
--
-- Alleen bedrijfsgegevens uit openbare bronnen: shopnaam, website, bol-winkel,
-- platform, een algemeen contactadres (info@, klantenservice@) en wat de
-- eigen site openbaar laat zien. Geen namen of persoonlijke adressen van
-- medewerkers. Een lead die zich afmeldt, krijgt status 'afgemeld' en wordt
-- nooit meer benaderd. Alleen de service-role (backoffice) leest en schrijft.

CREATE TABLE IF NOT EXISTS sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  name text,
  website text NOT NULL,
  bol_url text,
  platform text,
  category text,
  contact_email text,
  linkedin_url text,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  score_reasons text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'nieuw' CHECK (status IN ('nieuw', 'goedgekeurd', 'benaderd', 'gereageerd', 'demo', 'trial', 'klant', 'afgewezen', 'afgemeld')),
  linkedin_draft text,
  email_subject text,
  email_draft text,
  drafted_at timestamptz,
  next_action text,
  next_action_at timestamptz,
  contacted_at timestamptz,
  notes text,
  source text,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_leads_status_score ON sales_leads (status, score DESC);
CREATE INDEX IF NOT EXISTS idx_sales_leads_next_action ON sales_leads (next_action_at) WHERE next_action_at IS NOT NULL;

-- Wat er met een lead gebeurde (status, concept, notitie), voor de tijdlijn in de CRM.
CREATE TABLE IF NOT EXISTS sales_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail text,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_lead_events_lead ON sales_lead_events (lead_id, created_at DESC);

ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_lead_events ENABLE ROW LEVEL SECURITY;
