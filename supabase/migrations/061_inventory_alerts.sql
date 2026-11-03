-- Vera, the stock assistant: rules that say when she speaks up, and the alerts
-- they raised. An alert stays open while its condition holds, so the same
-- thing is reported once; it closes when the condition is gone.
-- Server-side writes only; members of the workspace can read.

CREATE TABLE inventory_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('stock_below', 'days_below', 'sold_out', 'sales_spike', 'questions_on_short', 'back_in_stock', 'season_ahead', 'delivery_late', 'dead_stock_value', 'margin_below', 'returns_above')),
  -- Everything, one product (product key) or one variant (variant key).
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'product', 'variant')),
  target_key text CHECK (target_key IS NULL OR char_length(target_key) <= 400),
  target_label text CHECK (target_label IS NULL OR char_length(target_label) <= 300),
  threshold numeric(12,2),
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'all') = (target_key IS NULL))
);
CREATE INDEX inventory_alert_rules_tenant ON inventory_alert_rules (tenant_id);

CREATE TABLE inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES inventory_alert_rules(id) ON DELETE CASCADE,
  kind text NOT NULL,
  fingerprint text NOT NULL CHECK (char_length(fingerprint) <= 600),
  variant_key text,
  title text NOT NULL CHECK (char_length(title) <= 300),
  body text NOT NULL CHECK (char_length(body) <= 1000),
  impact numeric(12,2) NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  emailed_at timestamptz
);
CREATE UNIQUE INDEX inventory_alerts_open ON inventory_alerts (tenant_id, fingerprint) WHERE resolved_at IS NULL;
CREATE INDEX inventory_alerts_tenant ON inventory_alerts (tenant_id, opened_at DESC);

-- Alerts by mail (at most one a day); the default rules are added once.
ALTER TABLE inventory_settings
  ADD COLUMN IF NOT EXISTS alert_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_rules_seeded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_alert_email_at timestamptz;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['inventory_alert_rules', 'inventory_alerts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON %I FROM anon', table_name);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM authenticated', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_select ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_select ON %I FOR SELECT TO authenticated USING (tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = (SELECT auth.uid()) LIMIT 1))',
      table_name
    );
  END LOOP;
END $$;
