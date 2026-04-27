-- 018_replyos_autonomous_agent.sql
-- Foundation for ReplyOS browser-operated support workspaces.

CREATE TABLE IF NOT EXISTS replyos_work_apps (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_type              text        NOT NULL
                                      CHECK (app_type IN ('mailbox', 'commerce', 'crm', 'helpdesk', 'shipping', 'knowledge_base', 'other')),
  provider              text        NOT NULL,
  display_name          text        NOT NULL,
  base_url              text,
  status                text        NOT NULL DEFAULT 'setup_required'
                                      CHECK (status IN ('setup_required', 'active', 'login_expired', 'needs_mfa', 'paused', 'failed')),
  permission_level      text        NOT NULL DEFAULT 'read_only'
                                      CHECK (permission_level IN ('read_only', 'draft_only', 'submit_allowed', 'destructive_blocked')),
  runtime_provider      text        NOT NULL DEFAULT 'browserbase_openai_cua'
                                      CHECK (runtime_provider IN ('browserbase_openai_cua', 'local_playwright', 'manual_watch')),
  credential_status     text        NOT NULL DEFAULT 'not_configured'
                                      CHECK (credential_status IN ('not_configured', 'manual_session', 'stored_reference', 'expired')),
  session_storage_ref   text,
  allowed_domains       text[]      NOT NULL DEFAULT '{}'::text[],
  notes                 text,
  last_checked_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, display_name)
);

CREATE INDEX IF NOT EXISTS idx_replyos_work_apps_tenant
  ON replyos_work_apps (tenant_id, status, app_type);

CREATE TABLE IF NOT EXISTS replyos_agent_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id   uuid        REFERENCES support_conversations(id) ON DELETE SET NULL,
  work_app_id       uuid        REFERENCES replyos_work_apps(id) ON DELETE SET NULL,
  status            text        NOT NULL DEFAULT 'queued'
                                CHECK (status IN ('queued', 'running', 'waiting_for_human', 'ready_to_reply', 'sent', 'failed', 'cancelled')),
  objective         text        NOT NULL,
  risk_level        text        NOT NULL DEFAULT 'low'
                                CHECK (risk_level IN ('low', 'medium', 'high', 'blocked')),
  runtime_provider  text        NOT NULL DEFAULT 'browserbase_openai_cua'
                                CHECK (runtime_provider IN ('browserbase_openai_cua', 'local_playwright', 'manual_watch')),
  current_url       text,
  final_answer      text,
  failure_reason    text,
  model             text,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replyos_agent_runs_tenant_created
  ON replyos_agent_runs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_replyos_agent_runs_conversation
  ON replyos_agent_runs (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS replyos_agent_steps (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id          uuid        NOT NULL REFERENCES replyos_agent_runs(id) ON DELETE CASCADE,
  step_index      integer     NOT NULL,
  action_type     text        NOT NULL,
  status          text        NOT NULL DEFAULT 'recorded'
                              CHECK (status IN ('recorded', 'blocked', 'failed', 'completed')),
  url             text,
  summary         text        NOT NULL,
  model_decision  text,
  screenshot_ref  text,
  safety_flags    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  duration_ms     integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_replyos_agent_steps_run
  ON replyos_agent_steps (run_id, step_index);

ALTER TABLE replyos_work_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE replyos_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE replyos_agent_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON replyos_work_apps
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_select" ON replyos_agent_runs
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tenant_select" ON replyos_agent_steps
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );
