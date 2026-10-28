-- Inkoopadvies per variant: the merchant's own stock and sales, separate from
-- customer support. Everything here is about products, never about people:
-- daily totals per variant contain no customer data, so they may outlive the
-- 90-day order retention (kept 3 years, pruned by cleanup-old-email).
-- Server-side writes only; members of the workspace can read.

-- Every variant the shop sells, including ones that never sell (dead stock
-- does not show up in orders). One row per provider variant or bol.com offer;
-- rows of different channels share a variant_key when SKU or EAN match.
CREATE TABLE inventory_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES commerce_connections(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('shopify', 'woocommerce', 'bol', 'manual')),
  external_id text NOT NULL CHECK (char_length(external_id) BETWEEN 1 AND 300),
  variant_key text NOT NULL CHECK (char_length(variant_key) BETWEEN 1 AND 400),
  product_external_id text,
  product_title text NOT NULL,
  variant_title text,
  sku text,
  ean text,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  price numeric(12,2),
  unit_cost numeric(12,2),
  currency_code text NOT NULL DEFAULT 'EUR',
  stock integer,
  stock_tracked boolean NOT NULL DEFAULT true,
  -- bol.com stock that sits in the shop's own warehouse (FBR) mirrors the
  -- webshop stock; only LVB/FBB stock is counted on top of it.
  own_warehouse boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);
CREATE INDEX inventory_variants_key ON inventory_variants (tenant_id, variant_key);

-- Units sold per variant per day and channel ('import' for CSV history).
CREATE TABLE inventory_daily_sales (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  day date NOT NULL,
  channel text NOT NULL CHECK (channel IN ('shopify', 'woocommerce', 'bol', 'import')),
  units_sold integer NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0 CHECK (orders >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, variant_key, day, channel)
);
CREATE INDEX inventory_daily_sales_day ON inventory_daily_sales (tenant_id, day);

-- Stock per variant at the end of each day; jumps reveal deliveries and
-- zero days are left out of the sales speed.
CREATE TABLE inventory_daily_stock (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  day date NOT NULL,
  stock integer NOT NULL,
  PRIMARY KEY (tenant_id, variant_key, day)
);
CREATE INDEX inventory_daily_stock_day ON inventory_daily_stock (tenant_id, day);

-- Deliveries (batches): detected from stock jumps, entered by hand or
-- imported. A future received_on means the goods are still on their way.
CREATE TABLE inventory_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  received_on date NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2),
  source text NOT NULL CHECK (source IN ('detected', 'manual', 'import')),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, variant_key, received_on, source)
);
CREATE INDEX inventory_deliveries_tenant ON inventory_deliveries (tenant_id, received_on DESC);

-- How a shop buys: lead time, how long a delivery should last, buffer.
CREATE TABLE inventory_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  lead_time_days integer NOT NULL DEFAULT 21 CHECK (lead_time_days BETWEEN 0 AND 365),
  cover_weeks integer NOT NULL DEFAULT 8 CHECK (cover_weeks BETWEEN 1 AND 52),
  safety_buffer numeric(4,2) NOT NULL DEFAULT 0.20 CHECK (safety_buffer BETWEEN 0 AND 2),
  dead_after_days integer NOT NULL DEFAULT 90 CHECK (dead_after_days BETWEEN 14 AND 730),
  dead_cover_weeks integer NOT NULL DEFAULT 26 CHECK (dead_cover_weeks BETWEEN 4 AND 156),
  weekly_email boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  last_sync_error text,
  last_email_sent_at timestamptz,
  -- The computed report (per-variant figures), rebuilt by every sync so the
  -- page, the weekly mail and MCP answer without recomputing.
  report jsonb,
  report_built_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'inventory_variants',
    'inventory_daily_sales',
    'inventory_daily_stock',
    'inventory_deliveries',
    'inventory_settings'
  ] LOOP
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
