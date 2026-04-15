-- 016_ai_first_support.sql
-- Reconciles live schema drift and introduces the AI-first support model.

-- ── Reconcile live drift ────────────────────────────────────────────────────
ALTER TABLE tenant_agent_config
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS sender_name text;

ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS scope text;

COMMENT ON COLUMN tenants.plan IS 'Allowed values in app runtime: trial, starter, pro, agency, custom, expired';

-- ── Tenant email channels ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_email_channels (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inbound_address    text        NOT NULL UNIQUE,
  outbound_from_email text       NOT NULL,
  outbound_from_name text,
  is_default         boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_email_channels_tenant_id
  ON tenant_email_channels (tenant_id);

-- ── Support conversations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_conversations (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status                   text        NOT NULL DEFAULT 'review'
                                       CHECK (status IN ('open', 'review', 'sent', 'escalated', 'ignored', 'closed')),
  customer_email           text        NOT NULL,
  customer_name            text,
  subject_original         text        NOT NULL,
  subject_english          text,
  latest_inbound_message_id uuid,
  latest_decision_id       uuid,
  latest_message_at        timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_conversations_tenant_id
  ON support_conversations (tenant_id, latest_message_at DESC);

-- ── Support messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id   uuid        NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  direction         text        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  provider          text        NOT NULL DEFAULT 'resend',
  provider_message_id text,
  internet_message_id text,
  in_reply_to       text,
  message_references text,
  from_email        text        NOT NULL,
  from_name         text,
  to_email          text        NOT NULL,
  cc_emails         text[]      NOT NULL DEFAULT '{}'::text[],
  bcc_emails        text[]      NOT NULL DEFAULT '{}'::text[],
  subject_original  text        NOT NULL,
  body_original     text,
  language_original text,
  subject_english   text,
  body_english      text,
  translation_status text       NOT NULL DEFAULT 'pending'
                                  CHECK (translation_status IN ('pending', 'done', 'not_needed', 'error')),
  metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  received_at       timestamptz,
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id
  ON support_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_support_messages_tenant_id
  ON support_messages (tenant_id, created_at DESC);

-- ── Support decisions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_decisions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id        uuid        NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  source_message_id      uuid        REFERENCES support_messages(id) ON DELETE SET NULL,
  intent                 text        NOT NULL,
  confidence             numeric     NOT NULL,
  decision               text        NOT NULL
                                      CHECK (decision IN ('inform_customer', 'ask_question', 'escalate', 'ignore')),
  requires_human         boolean     NOT NULL DEFAULT true,
  reasons                jsonb       NOT NULL DEFAULT '[]'::jsonb,
  actions                jsonb       NOT NULL DEFAULT '[]'::jsonb,
  draft_subject_original text        NOT NULL,
  draft_body_original    text        NOT NULL,
  draft_language         text        NOT NULL,
  draft_subject_english  text,
  draft_body_english     text,
  translation_status     text        NOT NULL DEFAULT 'pending'
                                      CHECK (translation_status IN ('pending', 'done', 'not_needed', 'error')),
  review_status          text        NOT NULL DEFAULT 'pending_review'
                                      CHECK (review_status IN ('pending_review', 'approved', 'sent', 'escalated', 'ignored')),
  model                  text,
  prompt_version         text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_decisions_conversation_id
  ON support_decisions (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_decisions_tenant_id
  ON support_decisions (tenant_id, created_at DESC);

-- ── Translation cache ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translation_cache (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content_hash     text        NOT NULL,
  source_language  text,
  target_language  text        NOT NULL,
  context_type     text        NOT NULL
                                  CHECK (context_type IN ('customer_message', 'draft', 'subject')),
  original_text    text        NOT NULL,
  translated_text  text        NOT NULL,
  model            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, content_hash, target_language, context_type)
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_tenant_hash
  ON translation_cache (tenant_id, content_hash);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE tenant_email_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON tenant_email_channels
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_select" ON support_conversations
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_select" ON support_messages
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_select" ON support_decisions
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_select" ON translation_cache
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );
