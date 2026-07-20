-- Agent DNA: per-tenant bespoke agent profile, built by mining the tenant's
-- own mailbox history during onboarding and refined by a continuous learning
-- loop on human edits. See plan "Agent DNA — Bespoke Agent per Klant".

-- ── Mining job queue (one row per onboarding mining run) ─────────────────────
CREATE TABLE IF NOT EXISTS mining_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued', -- queued|running|distilling|done|failed
  phase text,                            -- human-readable progress label for the UI
  months_back int NOT NULL DEFAULT 12,
  sent_scanned int NOT NULL DEFAULT 0,
  exchanges_paired int NOT NULL DEFAULT 0,
  exchanges_mined int NOT NULL DEFAULT 0,
  cursor_state jsonb,                    -- resumable position between worker ticks
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mining_jobs_status ON mining_jobs (status, created_at);

-- ── Paired customer-question → merchant-reply exchanges from history ────────
CREATE TABLE IF NOT EXISTS mined_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES mining_jobs(id) ON DELETE CASCADE,
  inbound_message_id text,
  reply_message_id text NOT NULL,
  subject text,
  customer_text text,
  reply_text text,
  intent text,
  quality int,          -- 1..5 LLM-scored usefulness of the merchant reply
  facts jsonb,          -- [{text, kind: fact|promise|house_rule}]
  tone_notes text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reply_message_id)
);
CREATE INDEX IF NOT EXISTS idx_mined_exchanges_tenant ON mined_exchanges (tenant_id, intent);

-- ── Distilled agent profile (1:1 with tenant) ───────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_agent_profile (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',  -- draft|active
  identity jsonb,       -- {greeting, signoff, pronoun, companyDescriptor}
  voice_notes text,     -- distilled voice baseline (used as base, agent writes at professional standard)
  stats jsonb,          -- {exchanges, monthsBack, distilledAt}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Individual facts / house rules / exemplars, human-gated ────────────────
CREATE TABLE IF NOT EXISTS tenant_profile_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,                      -- fact|house_rule|exemplar
  intent text,                             -- exemplars: which intent they exemplify
  content text NOT NULL,                   -- the fact/rule text; exemplars: "Q: ...\nA: ..."
  source_refs jsonb,                       -- [{messageId, subject, date}] provenance
  confidence numeric,
  status text NOT NULL DEFAULT 'proposed', -- proposed|approved|rejected
  origin text NOT NULL DEFAULT 'mining',   -- mining|learning|manual
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_facts_tenant_status ON tenant_profile_facts (tenant_id, status, kind);

-- ── Learning loop: preserve the untouched AI original next to the human edit ─
ALTER TABLE support_decisions ADD COLUMN IF NOT EXISTS draft_body_ai text;
COMMENT ON COLUMN support_decisions.draft_body_ai IS 'Untouched AI draft as generated; draft_body_original may be overwritten by the human edit on approve-send.';

-- ── Similarity search over approved facts (mirrors match_knowledge_chunks) ──
create or replace function match_profile_facts(
  query_embedding vector(1536),
  filter_tenant_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  kind text,
  content text,
  confidence numeric,
  similarity float
)
language sql stable
as $$
  select
    f.id,
    f.kind,
    f.content,
    f.confidence,
    1 - (f.embedding <=> query_embedding) as similarity
  from tenant_profile_facts f
  where f.tenant_id = filter_tenant_id
    and f.status = 'approved'
    and f.embedding is not null
    and 1 - (f.embedding <=> query_embedding) > match_threshold
  order by f.embedding <=> query_embedding
  limit match_count;
$$;

-- ── RLS: members of the tenant can read; writes go through service role ─────
ALTER TABLE mining_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mined_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_agent_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_profile_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON mining_jobs
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "tenant_select" ON mined_exchanges
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "tenant_select" ON tenant_agent_profile
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "tenant_select" ON tenant_profile_facts
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  );
