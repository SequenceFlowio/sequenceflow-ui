-- Commerce Intelligence Vertical Slice v1.
-- Adds the Agent DNA learning audit trail, a normalized commerce model,
-- approval-gated actions, outcomes, and privacy-preserving case memory.

ALTER TABLE support_decisions
  ADD COLUMN IF NOT EXISTS draft_body_ai text;

CREATE OR REPLACE FUNCTION preserve_support_decision_ai_draft()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.draft_body_ai IS NOT NULL
    AND NEW.draft_body_ai IS DISTINCT FROM OLD.draft_body_ai THEN
    RAISE EXCEPTION 'draft_body_ai is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_decisions_preserve_ai_draft ON support_decisions;
CREATE TRIGGER support_decisions_preserve_ai_draft
  BEFORE UPDATE OF draft_body_ai ON support_decisions
  FOR EACH ROW EXECUTE FUNCTION preserve_support_decision_ai_draft();

ALTER TABLE tenant_profile_facts
  ADD COLUMN IF NOT EXISTS content_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_learning_content_hash
  ON tenant_profile_facts (tenant_id, content_hash)
  WHERE content_hash IS NOT NULL AND origin = 'learning';

CREATE OR REPLACE FUNCTION match_profile_fact_candidates(
  query_embedding vector(1536),
  filter_tenant_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (id uuid, status text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT f.id, f.status, 1 - (f.embedding <=> query_embedding) AS similarity
  FROM tenant_profile_facts f
  WHERE f.tenant_id = filter_tenant_id
    AND f.status IN ('approved', 'proposed')
    AND f.embedding IS NOT NULL
    AND 1 - (f.embedding <=> query_embedding) > match_threshold
  ORDER BY f.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE TABLE IF NOT EXISTS profile_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL,
  proposed_fact_id uuid REFERENCES tenant_profile_facts(id) ON DELETE SET NULL,
  normalized_ai text NOT NULL,
  normalized_human text NOT NULL,
  normalized_diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  edit_distance numeric NOT NULL CHECK (edit_distance >= 0 AND edit_distance <= 1),
  classification text NOT NULL CHECK (classification IN ('fact', 'policy', 'tone', 'structure', 'other')),
  candidate_rule text,
  confidence numeric NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  content_hash text,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processing', 'processed', 'proposed', 'ignored', 'failed')),
  error text,
  processing_ms integer NOT NULL DEFAULT 0 CHECK (processing_ms >= 0),
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_learning_tenant_created
  ON profile_learning_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_learning_retention ON profile_learning_events (created_at);
CREATE INDEX IF NOT EXISTS idx_profile_learning_processing
  ON profile_learning_events (status, processed_at)
  WHERE status IN ('processing', 'failed');

CREATE OR REPLACE FUNCTION claim_profile_learning_decisions(p_limit integer DEFAULT 30)
RETURNS TABLE (
  event_id uuid,
  decision_id uuid,
  tenant_id uuid,
  draft_body_ai text,
  draft_body_original text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stale_candidates AS (
    SELECT event.id
    FROM profile_learning_events event
    JOIN support_decisions decision ON decision.id = event.decision_id
    WHERE event.status IN ('processing', 'failed')
      AND event.processed_at < now() - interval '10 minutes'
      AND decision.review_status = 'sent'
    ORDER BY event.processed_at ASC
    LIMIT p_limit
    FOR UPDATE OF event SKIP LOCKED
  ),
  stale AS (
    UPDATE profile_learning_events event
      SET status = 'processing', processed_at = now(), error = NULL
    FROM stale_candidates claimed, support_decisions decision
    WHERE event.id = claimed.id
      AND decision.id = event.decision_id
    RETURNING event.id, event.decision_id, event.tenant_id,
      decision.draft_body_ai, decision.draft_body_original
  ),
  candidates AS (
    SELECT decision.id, decision.tenant_id, decision.draft_body_ai, decision.draft_body_original
    FROM support_decisions decision
    WHERE decision.review_status = 'sent'
      AND decision.draft_body_ai IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM profile_learning_events event WHERE event.decision_id = decision.id
      )
    ORDER BY decision.updated_at ASC
    LIMIT GREATEST(0, p_limit - (SELECT count(*) FROM stale))
    FOR UPDATE OF decision SKIP LOCKED
  ),
  inserted AS (
    INSERT INTO profile_learning_events (
      tenant_id, decision_id, normalized_ai, normalized_human, normalized_diff,
      edit_distance, classification, confidence, status, processed_at
    )
    SELECT candidate.tenant_id, candidate.id, '', '', '{}'::jsonb,
      0, 'other', 0, 'processing', now()
    FROM candidates candidate
    ON CONFLICT (decision_id) DO NOTHING
    RETURNING id, decision_id, tenant_id
  )
  SELECT stale.id, stale.decision_id, stale.tenant_id, stale.draft_body_ai, stale.draft_body_original
  FROM stale
  UNION ALL
  SELECT inserted.id, inserted.decision_id, inserted.tenant_id,
    decision.draft_body_ai, decision.draft_body_original
  FROM inserted
  JOIN support_decisions decision ON decision.id = inserted.decision_id
  LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION claim_profile_learning_decisions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_profile_learning_decisions(integer) TO service_role;

CREATE TABLE IF NOT EXISTS commerce_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('shopify')),
  shop_domain text NOT NULL,
  display_name text,
  client_id text NOT NULL,
  client_secret_encrypted text NOT NULL,
  access_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'test_required'
    CHECK (status IN ('test_required', 'active', 'paused', 'failed')),
  action_mode text NOT NULL DEFAULT 'disabled'
    CHECK (action_mode IN ('disabled', 'approval_required')),
  max_cancel_amount numeric(12,2) NOT NULL DEFAULT 250 CHECK (max_cancel_amount >= 0),
  shop_currency text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider),
  UNIQUE (provider, shop_domain)
);

CREATE TABLE IF NOT EXISTS commerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES commerce_connections(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('shopify')),
  external_id text NOT NULL,
  display_name text NOT NULL,
  customer_key text,
  financial_status text,
  fulfillment_status text,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL,
  cancelable boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  order_created_at timestamptz NOT NULL,
  provider_updated_at timestamptz,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_customer
  ON commerce_orders (tenant_id, customer_key, order_created_at DESC)
  WHERE customer_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_orders_display_name
  ON commerce_orders (tenant_id, display_name);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_connection
  ON commerce_orders (connection_id, provider_updated_at DESC);

CREATE TABLE IF NOT EXISTS commerce_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  product_external_id text,
  variant_external_id text,
  sku text,
  title text NOT NULL,
  variant_title text,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_items_tenant_sku
  ON commerce_order_items (tenant_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commerce_items_order ON commerce_order_items (order_id);

CREATE TABLE IF NOT EXISTS commerce_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  status text,
  tracking_company text,
  tracking_number text,
  tracking_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_fulfillments_order ON commerce_fulfillments (order_id);

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
  IF NOT EXISTS (SELECT 1 FROM commerce_orders WHERE id = p_order_id AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Commerce order does not belong to tenant';
  END IF;

  DELETE FROM commerce_order_items WHERE tenant_id = p_tenant_id AND order_id = p_order_id;
  INSERT INTO commerce_order_items (
    tenant_id, order_id, external_id, product_external_id, variant_external_id,
    sku, title, variant_title, quantity
  )
  SELECT p_tenant_id, p_order_id, item.external_id, item.product_external_id,
    item.variant_external_id, item.sku, item.title, item.variant_title, item.quantity
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    external_id text, product_external_id text, variant_external_id text,
    sku text, title text, variant_title text, quantity integer
  );

  DELETE FROM commerce_fulfillments WHERE tenant_id = p_tenant_id AND order_id = p_order_id;
  INSERT INTO commerce_fulfillments (
    tenant_id, order_id, external_id, status, tracking_company, tracking_number, tracking_url
  )
  SELECT p_tenant_id, p_order_id, fulfillment.external_id, fulfillment.status,
    fulfillment.tracking_company, fulfillment.tracking_number, fulfillment.tracking_url
  FROM jsonb_to_recordset(COALESCE(p_fulfillments, '[]'::jsonb)) AS fulfillment(
    external_id text, status text, tracking_company text, tracking_number text, tracking_url text
  );
END;
$$;
REVOKE ALL ON FUNCTION replace_commerce_order_children(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_commerce_order_children(uuid, uuid, jsonb, jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS conversation_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  link_status text NOT NULL DEFAULT 'linked' CHECK (link_status IN ('candidate', 'linked')),
  match_method text NOT NULL CHECK (match_method IN ('order_number', 'customer_email', 'manual')),
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_links_conversation ON conversation_entity_links (conversation_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_candidates
  ON conversation_entity_links (conversation_id, created_at DESC)
  WHERE link_status = 'candidate';
CREATE INDEX IF NOT EXISTS idx_entity_links_order ON conversation_entity_links (order_id);

CREATE TABLE IF NOT EXISTS commerce_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES commerce_connections(id) ON DELETE CASCADE,
  order_id uuid REFERENCES commerce_orders(id) ON DELETE SET NULL,
  provider_event_id text NOT NULL,
  topic text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error text,
  processed_at timestamptz,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_events_tenant_occurred
  ON commerce_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_events_order ON commerce_events (order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_events_failed
  ON commerce_events (created_at) WHERE status = 'failed';

CREATE TABLE IF NOT EXISTS commerce_action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES support_conversations(id) ON DELETE SET NULL,
  decision_id uuid REFERENCES support_decisions(id) ON DELETE SET NULL,
  order_id uuid REFERENCES commerce_orders(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('cancel_order')),
  action_fingerprint text NOT NULL,
  rationale text NOT NULL,
  risk_level text NOT NULL DEFAULT 'high' CHECK (risk_level IN ('low', 'medium', 'high', 'blocked')),
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'rejected', 'executing', 'succeeded', 'failed', 'blocked')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  completed_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, action_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_commerce_actions_conversation
  ON commerce_action_proposals (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_actions_pending
  ON commerce_action_proposals (created_at)
  WHERE status IN ('approved', 'executing', 'failed');
CREATE INDEX IF NOT EXISTS idx_commerce_actions_retention ON commerce_action_proposals (created_at);

CREATE TABLE IF NOT EXISTS commerce_action_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES commerce_action_proposals(id) ON DELETE CASCADE,
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
  status text NOT NULL CHECK (status IN ('started', 'provider_pending', 'succeeded', 'failed')),
  request_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_job_id text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, attempt)
);
CREATE INDEX IF NOT EXISTS idx_commerce_executions_proposal ON commerce_action_executions (proposal_id);

CREATE TABLE IF NOT EXISTS operational_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES support_conversations(id) ON DELETE SET NULL,
  order_id uuid REFERENCES commerce_orders(id) ON DELETE SET NULL,
  action_id uuid REFERENCES commerce_action_proposals(id) ON DELETE SET NULL,
  outcome_type text NOT NULL CHECK (outcome_type IN (
    'action_proposed', 'action_approved', 'action_rejected', 'action_succeeded',
    'action_failed', 'reply_sent', 'repeat_contact_7d', 'repeat_contact_30d',
    'commerce_context_matched', 'commerce_context_ambiguous', 'commerce_context_unmatched'
  )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operational_outcomes_tenant
  ON operational_outcomes (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_outcomes_conversation ON operational_outcomes (conversation_id);

CREATE OR REPLACE FUNCTION record_action_proposed_outcome()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO operational_outcomes (
    tenant_id, conversation_id, order_id, action_id, outcome_type, metadata
  ) VALUES (
    NEW.tenant_id, NEW.conversation_id, NEW.order_id, NEW.id,
    'action_proposed', jsonb_build_object('status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commerce_action_proposal_outcome ON commerce_action_proposals;
CREATE TRIGGER commerce_action_proposal_outcome
  AFTER INSERT ON commerce_action_proposals
  FOR EACH ROW EXECUTE FUNCTION record_action_proposed_outcome();

CREATE TABLE IF NOT EXISTS case_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_conversation_id uuid REFERENCES support_conversations(id) ON DELETE SET NULL,
  customer_key text NOT NULL,
  summary text NOT NULL,
  intents text[] NOT NULL DEFAULT '{}'::text[],
  order_refs text[] NOT NULL DEFAULT '{}'::text[],
  final_outcome text,
  closed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_case_memories_lookup
  ON case_memories (tenant_id, customer_key, closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_memories_expiry ON case_memories (expires_at);

CREATE TABLE IF NOT EXISTS operational_metrics_daily (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, metric_date)
);

CREATE TABLE IF NOT EXISTS commerce_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commerce_audit_tenant_created
  ON commerce_audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_audit_retention ON commerce_audit_events (created_at);

ALTER TABLE support_decisions
  ADD COLUMN IF NOT EXISTS blocking_action_id uuid REFERENCES commerce_action_proposals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_support_decisions_blocking_action
  ON support_decisions (blocking_action_id) WHERE blocking_action_id IS NOT NULL;

ALTER TABLE profile_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_action_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profile_learning_events', 'commerce_connections', 'commerce_orders',
    'commerce_order_items', 'commerce_fulfillments', 'conversation_entity_links',
    'commerce_events', 'commerce_action_proposals', 'commerce_action_executions',
    'operational_outcomes', 'case_memories', 'operational_metrics_daily',
    'commerce_audit_events'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY tenant_select ON %I FOR SELECT TO authenticated USING (tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = (SELECT auth.uid()) LIMIT 1))',
      table_name
    );
  END LOOP;
END $$;
