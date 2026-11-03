-- Suppliers for the inkoopadvies, so Vera can draft a purchase order per
-- supplier (fase 3) and the order quantity can use the supplier's lead time
-- instead of the one lead time of the shop. Which product comes from which
-- supplier is stored on inventory_settings.product_suppliers as
-- { "<product key>": "<supplier id>" }, like product_seasons.
-- Server-side writes only; members of the workspace can read.

CREATE TABLE inventory_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email text CHECK (email IS NULL OR char_length(email) <= 200),
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days BETWEEN 0 AND 365),
  min_order_qty integer NOT NULL DEFAULT 0 CHECK (min_order_qty BETWEEN 0 AND 1000000),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_suppliers_tenant ON inventory_suppliers (tenant_id, name);

ALTER TABLE inventory_settings
  ADD COLUMN IF NOT EXISTS product_suppliers jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['inventory_suppliers'] LOOP
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
