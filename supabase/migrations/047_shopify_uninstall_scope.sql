-- Uninstalling the Shopify app must not stop an existing (linked) workspace:
-- its mailbox and autosend keep serving non-Shopify customers. Only a workspace
-- created for the shop is paused as a whole; otherwise only Shopify access goes.
CREATE OR REPLACE FUNCTION uninstall_shopify_installation(p_shop text, p_event_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE receipt shopify_webhook_jobs%ROWTYPE; install shopify_installations%ROWTYPE;
BEGIN
  SELECT * INTO receipt FROM shopify_webhook_jobs
    WHERE shop_domain = p_shop AND topic = 'app/uninstalled' AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing uninstall receipt'; END IF;
  IF receipt.status = 'completed' THEN RETURN; END IF;
  SELECT * INTO install FROM shopify_installations WHERE shop_domain = p_shop FOR UPDATE;
  UPDATE shopify_installations SET status = 'uninstalled', access_token_encrypted = NULL,
    refresh_token_encrypted = NULL, access_expires_at = NULL, refresh_expires_at = NULL,
    token_lock_id = NULL, token_lock_until = NULL, uninstalled_at = now(), updated_at = now()
    WHERE shop_domain = p_shop;
  IF install.tenant_id IS NOT NULL AND install.tenant_origin = 'created' THEN
    UPDATE tenant_agent_config SET autosend_enabled = false WHERE tenant_id = install.tenant_id;
    UPDATE tenant_email_channels SET imap_status = 'test_required', smtp_status = 'test_required' WHERE tenant_id = install.tenant_id;
  END IF;
  UPDATE commerce_connections SET status = 'paused', events_status = 'paused', access_token_encrypted = NULL, token_expires_at = NULL
    WHERE shop_domain = p_shop AND provider = 'shopify' AND auth_mode = 'oauth';
  UPDATE shopify_webhook_jobs SET status = 'completed', completed_at = now(), payload_encrypted = '' WHERE id = receipt.id;
END $$;
REVOKE ALL ON FUNCTION uninstall_shopify_installation(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION uninstall_shopify_installation(text,text) TO service_role;
