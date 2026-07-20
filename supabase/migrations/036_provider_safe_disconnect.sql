-- Disconnect one commerce provider without touching another provider's actions.
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
  IF p_provider NOT IN ('shopify', 'woocommerce') THEN
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

  PERFORM proposal.id
  FROM commerce_action_proposals proposal
  JOIN commerce_orders order_record ON order_record.id = proposal.order_id
  WHERE proposal.tenant_id = p_tenant_id
    AND order_record.connection_id = v_connection_id
    AND proposal.status IN ('proposed', 'approved', 'executing', 'failed')
  FOR UPDATE OF proposal;

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
      last_error = CASE p_provider
        WHEN 'woocommerce' THEN 'WooCommerce was disconnected before execution.'
        ELSE 'Shopify was disconnected before execution.'
      END,
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
