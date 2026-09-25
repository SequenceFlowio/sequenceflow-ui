-- Public Shopify installations are separate from legacy merchant credentials.
-- Only server-side service_role may access tokens or provision tenants.
CREATE TABLE shopify_installations (
  shop_domain text PRIMARY KEY CHECK (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  tenant_id uuid UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','uninstalled')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  token_lock_id uuid,
  token_lock_until timestamptz,
  installed_at timestamptz,
  uninstalled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE shopify_installations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shopify_installations FROM anon, authenticated;

CREATE TABLE shopify_webhook_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  shop_domain text NOT NULL,
  topic text NOT NULL,
  payload_encrypted text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(shop_domain, topic, event_id)
);
ALTER TABLE shopify_webhook_jobs ADD COLUMN claimed_at timestamptz, ADD COLUMN last_error text;
CREATE INDEX shopify_webhook_pending ON shopify_webhook_jobs(created_at) WHERE status IN ('pending','failed','processing');
ALTER TABLE shopify_webhook_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shopify_webhook_jobs FROM anon, authenticated;

-- A DB lease serializes offline exchanges and refreshes across server instances.
CREATE FUNCTION claim_shopify_token_lock(p_shop text, p_lock uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO shopify_installations(shop_domain) VALUES (p_shop) ON CONFLICT DO NOTHING;
  UPDATE shopify_installations SET token_lock_id = p_lock, token_lock_until = now() + interval '60 seconds'
    WHERE shop_domain = p_shop AND (token_lock_until IS NULL OR token_lock_until < now());
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION claim_shopify_token_lock(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_shopify_token_lock(text,uuid) TO service_role;

-- Called only after verified online owner access and successful token exchange.
-- Stores the tokens only. Which workspace the shop belongs to is a separate,
-- explicit choice by the shop owner (attach_shopify_tenant): a new workspace or
-- an existing one proven with a one-time link code.
CREATE FUNCTION activate_shopify_installation(
  p_shop text, p_lock uuid, p_access text, p_refresh text,
  p_access_expires timestamptz, p_refresh_expires timestamptz, p_client_id text, p_client_secret text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_install shopify_installations%ROWTYPE;
BEGIN
  SELECT * INTO current_install FROM shopify_installations WHERE shop_domain = p_shop FOR UPDATE;
  IF NOT FOUND OR current_install.token_lock_id IS DISTINCT FROM p_lock OR current_install.token_lock_until < now() THEN
    RAISE EXCEPTION 'Shopify token lease lost';
  END IF;
  UPDATE shopify_installations SET status = 'active',
    access_token_encrypted = p_access, refresh_token_encrypted = p_refresh,
    access_expires_at = p_access_expires, refresh_expires_at = p_refresh_expires,
    installed_at = CASE WHEN current_install.status <> 'active' THEN now() ELSE installed_at END,
    uninstalled_at = NULL, updated_at = now(), token_lock_id = NULL, token_lock_until = NULL
    WHERE shop_domain = p_shop;
  -- Reinstall of a shop that already belongs to a workspace: reactivate its connection.
  IF current_install.tenant_id IS NOT NULL THEN
    INSERT INTO commerce_connections(tenant_id,provider,shop_domain,client_id,client_secret_encrypted,
      auth_mode,status,action_mode,scopes,setup_stage)
      VALUES(current_install.tenant_id,'shopify',p_shop,p_client_id,p_client_secret,'oauth','active','disabled',ARRAY['read_orders'],'mailbox')
      ON CONFLICT (tenant_id,provider) DO UPDATE SET status = 'active', auth_mode = 'oauth', action_mode = 'disabled',
        shop_domain = EXCLUDED.shop_domain, client_id = EXCLUDED.client_id,
        client_secret_encrypted = EXCLUDED.client_secret_encrypted, scopes = ARRAY['read_orders'], updated_at = now();
  END IF;
  RETURN current_install.tenant_id;
END $$;
REVOKE ALL ON FUNCTION activate_shopify_installation(text,uuid,text,text,timestamptz,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_shopify_installation(text,uuid,text,text,timestamptz,timestamptz,text,text) TO service_role;

-- Uninstall fences in-flight token writers by invalidating their lease.
CREATE FUNCTION uninstall_shopify_installation(p_shop text, p_event_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE receipt shopify_webhook_jobs%ROWTYPE;
BEGIN
  SELECT * INTO receipt FROM shopify_webhook_jobs
    WHERE shop_domain = p_shop AND topic = 'app/uninstalled' AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing uninstall receipt'; END IF;
  IF receipt.status = 'completed' THEN RETURN; END IF;
  UPDATE shopify_installations SET status = 'uninstalled', access_token_encrypted = NULL,
    refresh_token_encrypted = NULL, access_expires_at = NULL, refresh_expires_at = NULL,
    token_lock_id = NULL, token_lock_until = NULL, uninstalled_at = now(), updated_at = now()
    WHERE shop_domain = p_shop;
  UPDATE tenant_agent_config SET autosend_enabled = false WHERE tenant_id = (SELECT tenant_id FROM shopify_installations WHERE shop_domain = p_shop);
  UPDATE tenant_email_channels SET imap_status = 'test_required', smtp_status = 'test_required' WHERE tenant_id = (SELECT tenant_id FROM shopify_installations WHERE shop_domain = p_shop);
  UPDATE commerce_connections SET status = 'paused', events_status = 'paused', access_token_encrypted = NULL, token_expires_at = NULL
    WHERE shop_domain = p_shop AND provider = 'shopify' AND auth_mode = 'oauth';
  UPDATE shopify_webhook_jobs SET status = 'completed', completed_at = now(), payload_encrypted = '' WHERE id = receipt.id;
END $$;
REVOKE ALL ON FUNCTION uninstall_shopify_installation(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION uninstall_shopify_installation(text,text) TO service_role;

ALTER TABLE shopify_installations
  ADD COLUMN shop_id text,
  ADD COLUMN billing_plan text CHECK (billing_plan IN ('trial','starter','pro','agency','expired')),
  ADD COLUMN billing_trial_ends_at timestamptz,
  ADD COLUMN billing_period_start timestamptz,
  ADD COLUMN billing_checked_at timestamptz;

-- Where the workspace came from decides what shop/redact may delete:
-- 'created' = made for this shop (delete everything), 'linked' = an existing
-- SequenceFlow workspace (delete only what came from Shopify).
ALTER TABLE shopify_installations
  ADD COLUMN tenant_origin text CHECK (tenant_origin IN ('created','linked'));

-- One-time codes an admin of an existing workspace creates in the regular app
-- to prove ownership when linking a Shopify shop. Only the SHA-256 is stored.
CREATE TABLE shopify_link_codes (
  code_hash text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_shop text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE shopify_link_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shopify_link_codes FROM anon, authenticated;
CREATE INDEX shopify_link_codes_tenant ON shopify_link_codes(tenant_id);

-- The owner's explicit choice: p_code_hash NULL = new workspace for this shop,
-- otherwise link the workspace that issued the (unused, unexpired) code.
CREATE FUNCTION attach_shopify_tenant(p_shop text, p_code_hash text, p_client_id text, p_client_secret text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_install shopify_installations%ROWTYPE; code shopify_link_codes%ROWTYPE; resolved_tenant uuid; origin text;
BEGIN
  SELECT * INTO current_install FROM shopify_installations WHERE shop_domain = p_shop FOR UPDATE;
  IF NOT FOUND OR current_install.status <> 'active' THEN RAISE EXCEPTION 'Shopify installation is not active'; END IF;
  IF current_install.tenant_id IS NOT NULL THEN RETURN current_install.tenant_id; END IF;
  IF p_code_hash IS NULL THEN
    INSERT INTO tenants(name) VALUES(p_shop) RETURNING id INTO resolved_tenant;
    INSERT INTO tenant_agent_config(tenant_id) VALUES(resolved_tenant);
    origin := 'created';
  ELSE
    SELECT * INTO code FROM shopify_link_codes WHERE code_hash = p_code_hash FOR UPDATE;
    IF NOT FOUND OR code.used_at IS NOT NULL OR code.expires_at < now() THEN RAISE EXCEPTION 'Invalid or expired link code'; END IF;
    IF EXISTS(SELECT 1 FROM shopify_installations WHERE tenant_id = code.tenant_id) THEN
      RAISE EXCEPTION 'This workspace is already linked to a Shopify shop';
    END IF;
    UPDATE shopify_link_codes SET used_at = now(), used_by_shop = p_shop WHERE code_hash = p_code_hash;
    resolved_tenant := code.tenant_id;
    origin := 'linked';
  END IF;
  UPDATE shopify_installations SET tenant_id = resolved_tenant, tenant_origin = origin, updated_at = now() WHERE shop_domain = p_shop;
  INSERT INTO commerce_connections(tenant_id,provider,shop_domain,client_id,client_secret_encrypted,
    auth_mode,status,action_mode,scopes,setup_stage)
    VALUES(resolved_tenant,'shopify',p_shop,p_client_id,p_client_secret,'oauth','active','disabled',ARRAY['read_orders'],'mailbox')
    ON CONFLICT (tenant_id,provider) DO UPDATE SET status = 'active', auth_mode = 'oauth', action_mode = 'disabled',
      shop_domain = EXCLUDED.shop_domain, client_id = EXCLUDED.client_id,
      client_secret_encrypted = EXCLUDED.client_secret_encrypted, scopes = ARRAY['read_orders'], updated_at = now();
  RETURN resolved_tenant;
END $$;
REVOKE ALL ON FUNCTION attach_shopify_tenant(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION attach_shopify_tenant(text,text,text,text) TO service_role;
