-- Fix for 051: a shop has exactly one commerce connection (UNIQUE provider,
-- shop_domain), and cached order data points at it via (tenant_id, id). Moving
-- a shop therefore removes the previous workspace's Shopify connection and its
-- cached Shopify copies (orders, cursors), which the new workspace fetches again
-- from Shopify. Conversations and everything else of the old workspace stay.
CREATE OR REPLACE FUNCTION relink_shopify_tenant(p_shop text, p_code_hash text, p_client_id text, p_client_secret text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_install shopify_installations%ROWTYPE; code shopify_link_codes%ROWTYPE;
BEGIN
  SELECT * INTO current_install FROM shopify_installations WHERE shop_domain = p_shop FOR UPDATE;
  IF NOT FOUND OR current_install.status <> 'active' THEN RAISE EXCEPTION 'Shopify installation is not active'; END IF;
  SELECT * INTO code FROM shopify_link_codes WHERE code_hash = p_code_hash FOR UPDATE;
  IF NOT FOUND OR code.used_at IS NOT NULL OR code.expires_at < now() THEN RAISE EXCEPTION 'Invalid or expired link code'; END IF;
  IF current_install.tenant_id = code.tenant_id THEN
    UPDATE shopify_link_codes SET used_at = now(), used_by_shop = p_shop WHERE code_hash = p_code_hash;
    RETURN code.tenant_id;
  END IF;
  IF EXISTS(SELECT 1 FROM shopify_installations WHERE tenant_id = code.tenant_id AND shop_domain <> p_shop) THEN
    RAISE EXCEPTION 'This workspace is already linked to a Shopify shop';
  END IF;
  UPDATE shopify_link_codes SET used_at = now(), used_by_shop = p_shop WHERE code_hash = p_code_hash;
  DELETE FROM commerce_connections WHERE provider = 'shopify' AND shop_domain = p_shop AND tenant_id IS DISTINCT FROM code.tenant_id;
  UPDATE shopify_installations SET tenant_id = code.tenant_id, tenant_origin = 'linked', updated_at = now() WHERE shop_domain = p_shop;
  INSERT INTO commerce_connections(tenant_id,provider,shop_domain,client_id,client_secret_encrypted,
    auth_mode,status,action_mode,scopes,setup_stage)
    VALUES(code.tenant_id,'shopify',p_shop,p_client_id,p_client_secret,'oauth','active','disabled',ARRAY['read_orders'],'mailbox')
    ON CONFLICT (tenant_id,provider) DO UPDATE SET status = 'active', auth_mode = 'oauth', action_mode = 'disabled',
      shop_domain = EXCLUDED.shop_domain, client_id = EXCLUDED.client_id,
      client_secret_encrypted = EXCLUDED.client_secret_encrypted, scopes = ARRAY['read_orders'], updated_at = now();
  RETURN code.tenant_id;
END $$;
REVOKE ALL ON FUNCTION relink_shopify_tenant(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION relink_shopify_tenant(text,text,text,text) TO service_role;
