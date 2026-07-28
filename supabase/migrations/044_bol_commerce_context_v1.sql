ALTER TABLE commerce_connections
  DROP CONSTRAINT IF EXISTS commerce_connections_provider_check;
ALTER TABLE commerce_connections
  ADD CONSTRAINT commerce_connections_provider_check
  CHECK (provider IN ('shopify', 'woocommerce', 'bol'));

ALTER TABLE commerce_orders
  DROP CONSTRAINT IF EXISTS commerce_orders_provider_check;
ALTER TABLE commerce_orders
  ADD CONSTRAINT commerce_orders_provider_check
  CHECK (provider IN ('shopify', 'woocommerce', 'bol'));

ALTER TABLE commerce_connections
  ADD COLUMN IF NOT EXISTS external_account_id text,
  ADD COLUMN IF NOT EXISTS auth_mode text NOT NULL DEFAULT 'client_credentials',
  ADD COLUMN IF NOT EXISTS setup_stage text NOT NULL DEFAULT 'credentials',
  ADD COLUMN IF NOT EXISTS mailbox_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS events_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS last_returns_synced_at timestamptz;

ALTER TABLE commerce_connections
  DROP CONSTRAINT IF EXISTS commerce_connections_auth_mode_check;
ALTER TABLE commerce_connections
  ADD CONSTRAINT commerce_connections_auth_mode_check
  CHECK (auth_mode IN ('client_credentials', 'oauth'));

ALTER TABLE commerce_connections
  DROP CONSTRAINT IF EXISTS commerce_connections_setup_stage_check;
ALTER TABLE commerce_connections
  ADD CONSTRAINT commerce_connections_setup_stage_check
  CHECK (setup_stage IN ('credentials', 'api', 'events', 'mailbox', 'complete'));

ALTER TABLE commerce_connections
  DROP CONSTRAINT IF EXISTS commerce_connections_events_status_check;
ALTER TABLE commerce_connections
  ADD CONSTRAINT commerce_connections_events_status_check
  CHECK (events_status IN ('not_configured', 'pending', 'active', 'failed', 'paused'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_connections_provider_external_account
  ON commerce_connections (provider, external_account_id)
  WHERE external_account_id IS NOT NULL;

ALTER TABLE commerce_order_items
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS offer_external_id text,
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS fulfilment_method text,
  ADD COLUMN IF NOT EXISTS fulfilment_distribution_party text,
  ADD COLUMN IF NOT EXISTS cancellation_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latest_delivery_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_commerce_items_tenant_ean
  ON commerce_order_items (tenant_id, ean)
  WHERE ean IS NOT NULL;

ALTER TABLE commerce_fulfillments
  ADD COLUMN IF NOT EXISTS shipment_date timestamptz,
  ADD COLUMN IF NOT EXISTS transport_status_code text,
  ADD COLUMN IF NOT EXISTS transport_status_description text,
  ADD COLUMN IF NOT EXISTS latest_transport_event_at timestamptz;

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS reply_to_email text;

CREATE TABLE IF NOT EXISTS commerce_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  order_id uuid,
  provider text NOT NULL CHECK (provider IN ('bol')),
  external_id text NOT NULL,
  fulfilment_method text,
  registered_at timestamptz,
  handled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES commerce_connections (tenant_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commerce_returns_tenant_id
  ON commerce_returns (tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_commerce_returns_connection
  ON commerce_returns (tenant_id, connection_id, handled, registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_returns_order
  ON commerce_returns (tenant_id, order_id, registered_at DESC)
  WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commerce_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  return_id uuid NOT NULL,
  order_id uuid,
  external_id text NOT NULL,
  order_external_id text NOT NULL,
  ean text,
  title text,
  expected_quantity integer NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  handled_quantity integer NOT NULL DEFAULT 0 CHECK (handled_quantity >= 0),
  handled boolean NOT NULL DEFAULT false,
  handling_result text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (return_id, external_id),
  FOREIGN KEY (tenant_id, return_id)
    REFERENCES commerce_returns (tenant_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_commerce_return_items_order
  ON commerce_return_items (tenant_id, order_external_id);

CREATE TABLE IF NOT EXISTS commerce_offer_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  order_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('bol')),
  external_id text NOT NULL,
  ean text,
  bol_product_id text,
  fulfilment_method text,
  stock_amount integer,
  corrected_stock integer,
  price numeric(12,2),
  currency_code text NOT NULL DEFAULT 'EUR',
  for_sale boolean,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id, order_id),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES commerce_connections (tenant_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders (tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_offer_snapshots_order
  ON commerce_offer_snapshots (tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_offer_snapshots_ean
  ON commerce_offer_snapshots (tenant_id, ean)
  WHERE ean IS NOT NULL;

CREATE TABLE IF NOT EXISTS commerce_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('bol')),
  external_id text,
  resources text[] NOT NULL DEFAULT '{}'::text[],
  callback_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'failed', 'paused', 'deleted')),
  process_status_id text,
  signature_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_event_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connection_id, callback_url),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES commerce_connections (tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_subscriptions_health
  ON commerce_subscriptions (tenant_id, status, last_verified_at);

CREATE TABLE IF NOT EXISTS commerce_sync_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  resource text NOT NULL CHECK (resource IN ('orders', 'shipments', 'returns', 'offers')),
  cursor_value text,
  last_success_at timestamptz,
  next_run_at timestamptz,
  last_error text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connection_id, resource),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES commerce_connections (tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commerce_sync_cursors_due
  ON commerce_sync_cursors (resource, next_run_at)
  WHERE next_run_at IS NOT NULL;

ALTER TABLE commerce_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_offer_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_sync_cursors ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'commerce_returns',
    'commerce_return_items',
    'commerce_offer_snapshots',
    'commerce_subscriptions',
    'commerce_sync_cursors'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_select ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_select ON %I FOR SELECT TO authenticated USING (tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = (SELECT auth.uid()) LIMIT 1))',
      table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION replace_commerce_order_children(
  p_tenant_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_fulfillments jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM commerce_orders
    WHERE id = p_order_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Commerce order does not belong to tenant';
  END IF;

  DELETE FROM commerce_order_items
  WHERE tenant_id = p_tenant_id AND order_id = p_order_id;
  INSERT INTO commerce_order_items (
    tenant_id, order_id, external_id, product_external_id, variant_external_id,
    sku, title, variant_title, quantity, ean, offer_external_id, unit_price,
    fulfilment_method, fulfilment_distribution_party, cancellation_requested,
    latest_delivery_at
  )
  SELECT p_tenant_id, p_order_id, item.external_id, item.product_external_id,
    item.variant_external_id, item.sku, item.title, item.variant_title,
    item.quantity, item.ean, item.offer_external_id, item.unit_price,
    item.fulfilment_method, item.fulfilment_distribution_party,
    COALESCE(item.cancellation_requested, false), item.latest_delivery_at
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    external_id text,
    product_external_id text,
    variant_external_id text,
    sku text,
    title text,
    variant_title text,
    quantity integer,
    ean text,
    offer_external_id text,
    unit_price numeric,
    fulfilment_method text,
    fulfilment_distribution_party text,
    cancellation_requested boolean,
    latest_delivery_at timestamptz
  );

  DELETE FROM commerce_fulfillments
  WHERE tenant_id = p_tenant_id AND order_id = p_order_id;
  INSERT INTO commerce_fulfillments (
    tenant_id, order_id, external_id, status, tracking_company,
    tracking_number, tracking_url, shipment_date, transport_status_code,
    transport_status_description, latest_transport_event_at
  )
  SELECT p_tenant_id, p_order_id, item.external_id, item.status,
    item.tracking_company, item.tracking_number, item.tracking_url,
    item.shipment_date, item.transport_status_code,
    item.transport_status_description, item.latest_transport_event_at
  FROM jsonb_to_recordset(COALESCE(p_fulfillments, '[]'::jsonb)) AS item(
    external_id text,
    status text,
    tracking_company text,
    tracking_number text,
    tracking_url text,
    shipment_date timestamptz,
    transport_status_code text,
    transport_status_description text,
    latest_transport_event_at timestamptz
  );
END;
$$;

UPDATE commerce_connections
SET status = 'paused',
    action_mode = 'disabled',
    events_status = 'paused',
    last_error = 'Temporarily paused while SequenceFlow focuses on bol.com.',
    updated_at = now()
WHERE provider IN ('shopify', 'woocommerce');

INSERT INTO commerce_audit_events (
  tenant_id,
  actor_user_id,
  event_type,
  target_type,
  target_id,
  metadata
)
SELECT
  proposal.tenant_id,
  NULL,
  'action_blocked_provider_paused',
  'action',
  proposal.id::text,
  jsonb_build_object(
    'provider', orders.provider,
    'previousStatus', proposal.status,
    'reason', 'Provider temporarily paused while SequenceFlow focuses on bol.com.'
  )
FROM commerce_action_proposals proposal
JOIN commerce_orders orders ON orders.id = proposal.order_id
WHERE orders.provider IN ('shopify', 'woocommerce')
  AND proposal.status IN ('proposed', 'approved', 'executing', 'failed');

UPDATE commerce_action_proposals proposal
SET status = 'blocked',
    last_error = CASE
      WHEN proposal.status = 'executing'
        THEN 'Provider paused during an unresolved execution. Manual reconciliation is required.'
      ELSE 'Provider temporarily paused while SequenceFlow focuses on bol.com.'
    END,
    updated_at = now()
FROM commerce_orders orders
WHERE proposal.order_id = orders.id
  AND orders.provider IN ('shopify', 'woocommerce')
  AND proposal.status IN ('proposed', 'approved', 'executing', 'failed');

CREATE OR REPLACE FUNCTION disconnect_commerce_connection(
  p_tenant_id uuid,
  p_provider text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection_id uuid;
BEGIN
  IF p_provider NOT IN ('shopify', 'woocommerce', 'bol') THEN
    RAISE EXCEPTION 'Unsupported commerce provider.' USING ERRCODE = '22023';
  END IF;

  SELECT connection.id INTO v_connection_id
  FROM commerce_connections connection
  WHERE connection.tenant_id = p_tenant_id
    AND connection.provider = p_provider
  FOR UPDATE;

  IF v_connection_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM commerce_action_proposals proposal
    JOIN commerce_orders order_record ON order_record.id = proposal.order_id
    WHERE proposal.tenant_id = p_tenant_id
      AND order_record.connection_id = v_connection_id
      AND proposal.status = 'executing'
  ) THEN
    RAISE EXCEPTION 'Wait for the executing action for this provider before disconnecting.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE commerce_action_proposals proposal
  SET status = 'blocked',
      last_error = p_provider || ' was disconnected before execution.',
      updated_at = now()
  FROM commerce_orders order_record
  WHERE order_record.id = proposal.order_id
    AND order_record.connection_id = v_connection_id
    AND proposal.tenant_id = p_tenant_id
    AND proposal.status IN ('proposed', 'approved', 'failed');

  DELETE FROM commerce_connections
  WHERE id = v_connection_id
    AND tenant_id = p_tenant_id
    AND provider = p_provider;

  RETURN v_connection_id;
END;
$$;

REVOKE ALL ON FUNCTION disconnect_commerce_connection(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION disconnect_commerce_connection(uuid, text)
  TO service_role;
