# SupportFlow OS — Project Status
**Generated:** 2026-03-17
**Branch:** main
**Repo:** SequenceFlowio/sequenceflow-ui

---

## 1. ARCHITECTURE OVERVIEW

### Tech Stack
| Package | Version |
|---------|---------|
| Next.js | 16.1.6 |
| React | 19.2.3 |
| TypeScript | 5 |
| Tailwind CSS | 4 (via @tailwindcss/postcss) |
| @supabase/supabase-js | 2.98.0 |
| @supabase/ssr | 0.8.0 |
| openai | 6.22.0 |
| pdf-parse | 1.1.1 |

### Hosting
- **Provider:** Hostinger (cloud)
- **Domain:** `supportflow.sequenceflow.io`
- **Deployment:** Auto-deploy on every push to `main`
- **No CI/CD pipeline** — Hostinger builds directly from git

### Runtime Architecture
- Next.js App Router (`app/` directory)
- API routes: `app/api/**` (Node.js runtime)
- Authenticated pages: `app/(app)/` (requires Supabase session)
- Public pages: `app/login/`, `app/auth/`

---

## 2. DATABASE SCHEMA

**Supabase Project:** `tbxlejlkszorpxqzebqb.supabase.co`

### Tables

#### `tenants` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| name | text | |
| industry | text | |
| website_url | text | |
| created_at | timestamptz | |

#### `tenant_members` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| user_id | uuid FK→auth.users | |
| role | text | default: 'admin' |
| created_at | timestamptz | |

Unique constraint on `(tenant_id, user_id)`.
RLS policy: `user_id = auth.uid()` (each user sees only their own membership row — avoids circular recursion).

#### `profiles` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK FK→auth.users | |
| tenant_id | uuid FK→tenants | |
| role | text | default: 'admin' |
| created_at | timestamptz | |

#### `tenant_agent_config` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| tenant_id | uuid PK FK→tenants | |
| empathy_enabled | bool | default: true |
| allow_discount | bool | default: false |
| max_discount_amount | numeric | |
| signature | text | |
| language_default | text | default: 'nl' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `tenant_integrations` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid | |
| provider | text | 'gmail', 'bolcom', etc. |
| account_email | text | |
| access_token | text | |
| refresh_token | text | |
| expires_at | timestamptz | |
| status | text | 'connected' \| 'active' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique constraint on `(tenant_id, provider)`.

#### `tenant_templates` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| intent | text | |
| template_version | text | |
| template_text | text | |
| variables | jsonb | |
| confidence_weight | numeric | |
| is_active | bool | |
| created_at | timestamptz | |

Index on `(tenant_id, intent)`.

#### `support_events` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| user_id | uuid FK→auth.users | nullable |
| request_id | uuid | |
| source | text | |
| subject | text | max 120 chars |
| intent | text | |
| confidence | numeric | |
| template_id | uuid | nullable |
| latency_ms | int | |
| draft_text | text | |
| outcome | text | 'auto' \| 'auto_reply' \| 'human_review' \| 'error' |
| created_at | timestamptz | |

Append-only log. Index on `(tenant_id, created_at)`.

#### `tickets` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| gmail_message_id | text | nullable |
| gmail_thread_id | text | nullable |
| from_email | text | |
| from_name | text | nullable |
| subject | text | max 255 chars |
| body_text | text | |
| intent | text | |
| confidence | numeric | |
| status | text | 'draft' \| 'approved' \| 'escalated' \| 'sent' \| 'ignored' |
| ai_draft | jsonb | `{ subject, body, from }` |
| agent_notes | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Indexes on `(tenant_id)` and `(created_at DESC)`.

#### `knowledge_documents` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| client_id | uuid | ⚠️ Uses client_id NOT tenant_id (legacy) |
| type | text | 'policy' \| 'training' \| 'platform' |
| title | text | |
| source | text | |
| mime_type | text | |
| status | text | 'pending' \| 'processing' \| 'ready' \| 'error' |
| chunk_count | int | |
| error | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `knowledge_chunks` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| document_id | uuid FK→knowledge_documents | |
| client_id | uuid | ⚠️ Uses client_id NOT tenant_id (legacy) |
| type | text | |
| chunk_index | int | |
| content | text | |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| created_at | timestamptz | |

pgvector IVFFlat index on `embedding`. RPC: `match_knowledge_chunks(query_embedding, filter_client_id, match_threshold, match_count)`.

#### `support_agents` — RLS ✅
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK→tenants | |
| name | text | |
| model | text | |
| temperature | numeric | |
| max_tokens | int | |
| system_prompt | text | |
| created_at | timestamptz | |

#### `agent_config` — RLS ✅ (no policies — deny all)
Legacy global config table. Superseded by `tenant_agent_config`. Not used by any current code path.

#### `profiles` — RLS ✅
See above.

### RLS Policy Pattern
All tables (except `tenant_members` and `agent_config`) use:
```sql
tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
```
`tenant_members` uses `user_id = auth.uid()` to avoid circular recursion.
`knowledge_documents` / `knowledge_chunks` use `client_id` and include `OR client_id IS NULL` for platform docs.
Server-side routes use service role client — bypasses RLS entirely.

### Schema Discrepancies
- `knowledge_documents` and `knowledge_chunks` use `client_id` instead of `tenant_id` (known legacy issue, not yet migrated)
- `agent_config` table is unused — all config now in `tenant_agent_config`

---

## 3. PAGES & STATUS

### Public Pages

| Route | File | Status | Data |
|-------|------|--------|------|
| `/login` | `app/login/page.tsx` | ✅ Working | Mock ticket demo; real Google OAuth |
| `/auth/callback` | `app/auth/callback/route.ts` | ✅ Working | Supabase OAuth handler |

### Authenticated Pages (`app/(app)/`)

| Route | File | Status | Data | Notes |
|-------|------|--------|------|-------|
| `/inbox` | `inbox/page.tsx` | ✅ UI ready | Real (Supabase tickets) | Tickets table currently empty — n8n workflow fix just deployed |
| `/inbox/[id]` | `inbox/[id]/page.tsx` | ⚠️ Unknown | Real | Not audited |
| `/agent-console` | `agent-console/page.tsx` | ✅ Working | Real (API) | Loads/saves config; preview generation |
| `/knowledge` | `knowledge/page.tsx` | ✅ Working | Real (Supabase) | Upload, list, delete docs; platform tab admin-only |
| `/settings` | `settings/page.tsx` | ✅ Working | Real (API) | Policy tab loads/saves config; integrations tab shows Gmail status; team tab empty placeholder |
| `/dashboard` | `dashboard/page.tsx` | ⚠️ Unknown | Unknown | Not audited |

---

## 4. API ROUTES

### Auth & OAuth

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/callback` | GET | Supabase OAuth callback; exchanges code for session; redirects to `/inbox` |
| `/api/integrations/google/start` | GET | Initiates Google OAuth; encodes `tenant_id` in base64url state; scopes: gmail.readonly, gmail.compose, gmail.send, gmail.modify, email, profile |
| `/api/integrations/google/callback` | GET | Receives code from Google; exchanges for tokens; fetches userinfo email; upserts to `tenant_integrations` |
| `/api/integrations/status` | GET | Returns `{ integrations: { gmail: { connected, account_email, status } } }` for authenticated tenant |
| `/api/integrations/gmail/active` | GET | Called by n8n every minute; returns all `status IN ('connected','active')` Gmail integrations; auto-refreshes expired tokens |
| `/api/integrations/gmail/disconnect` | POST | Sets integration status to disconnected for authenticated tenant |

### AI & Support

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/support/generate` | POST | Core pipeline: JWT auth → tenant resolution → pgvector RAG → OpenAI gpt-4.1-mini → insert support_event + ticket → return draft. Role-gated: admin or system only. |
| `/api/agent-config` | GET | Returns `{ tenantId, config }` from `tenant_agent_config`; defaults if no row |
| `/api/agent-config` | POST | Upserts config for tenant (empathyEnabled, allowDiscount, maxDiscountAmount, signature) |

### Knowledge Management

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/knowledge/documents` | GET | Lists documents for tenant; filter by `?type=` |
| `/api/knowledge/upload` | POST | Multipart upload; stores in Supabase Storage `knowledge-uploads/{client_id}/{docId}/original.{ext}`; triggers ingestion |
| `/api/knowledge/reindex` | POST | Re-runs ingestion on existing document by `{ documentId }` |
| `/api/knowledge/document/[id]` | DELETE | Deletes document + storage file + chunks (cascade) |
| `/api/knowledge` | GET/DELETE | Returns 410 Gone (deprecated) |
| `/api/upload` | POST | Returns 410 Gone (deprecated) |

---

## 5. N8N WORKFLOW

**Active file:** `app/SupportFlow OS2current.json`
**Self-hosted n8n** connected to `supportflow.sequenceflow.io`

### Flow (in order)

| Node | Type | What it does |
|------|------|--------------|
| Schedule Trigger | scheduleTrigger | Runs on cron (every minute) |
| Supabase Sign In | httpRequest | POST to Supabase auth to get JWT for n8n machine user |
| GET mail integration | httpRequest | GET `https://supportflow.sequenceflow.io/api/integrations/gmail/active` |
| Refresh Token If Expired | code | Refreshes Gmail OAuth token if `expires_at` is past |
| Tenant ID not empty right? | if | Validates tenant_id is present before proceeding |
| Loop Over Items | splitInBatches | Iterates over each Gmail integration (tenant) |
| Get Gmail Messages | httpRequest | `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread` |
| Expand Gmail Messages | code | Expands message list |
| Get Gmail Message | httpRequest | Fetches full message by ID |
| Merge Gmail Metadata | merge | Merges message metadata |
| Parse Email | code | Extracts from, subject, body, threadId, listId, headers |
| filterGate | code | Blocks automated/marketing emails; checks for support keywords |
| If | if | Routes passed/blocked emails |
| Normalize Input | code | Standardizes fields; adds tenant_id, gmail tokens |
| Mark Email Read | httpRequest | Marks message as read in Gmail |
| Intent Classifier | code | Classifies intent: damaged, return, missing_items, order_status, complaint, address_change, unknown |
| Merge | merge | Merges with AI output |
| AI | httpRequest | POST `https://supportflow.sequenceflow.io/api/support/generate` — core AI call |
| Normalize Output | code | Recovers gmail_access_token + fields from Normalize Input after AI replaces $json |
| Build Email Raw | code | Constructs raw Gmail message (RFC 2822) |
| HTTP Request | httpRequest | POST `https://gmail.googleapis.com/gmail/v1/users/me/drafts` — creates draft |

### Hardcoded URLs
- `https://supportflow.sequenceflow.io/api/support/generate`
- `https://supportflow.sequenceflow.io/api/integrations/gmail/active`
- `https://tbxlejlkszorpxqzebqb.supabase.co/auth/v1/token?grant_type=password`
- `https://gmail.googleapis.com/gmail/v1/users/me/...`

### Known Issues
- Template node still exists in workflow but is no longer connected (bypassed as of 2026-03-17)
- Router node still exists but is no longer connected
- Workflow must be manually imported into n8n after each update to `SupportFlow OS2current.json`

---

## 6. INTEGRATIONS

### Supabase
- **Connection:** Service role via `SUPABASE_SERVICE_ROLE_KEY` (server-side); anon key via `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser)
- **Used for:** Auth (Supabase Auth), all data storage, pgvector similarity search, file storage
- **Storage bucket:** `knowledge-uploads`
- **RPC:** `match_knowledge_chunks` for vector similarity search
- **Tables used by generate route:** `tenant_agent_config`, `tenant_members`, `tenant_templates`, `knowledge_chunks`, `support_events`, `tickets`

### Gmail OAuth
- **Flow:** User clicks connect → `/api/integrations/google/start` → Google consent (scopes: gmail.readonly, compose, send, modify, email, profile) → `/api/integrations/google/callback` → tokens stored in `tenant_integrations`
- **Token refresh:** Auto-refreshed in `/api/integrations/gmail/active` when `expires_at <= now`
- **n8n usage:** Fetches active integrations every minute; uses access_token to call Gmail API

### OpenAI
- **Models used:**
  - `gpt-4.1-mini` — reply generation in `/api/support/generate`
  - `text-embedding-3-small` (1536 dims) — knowledge chunk embedding in `lib/embeddings.ts`
- **Used in:** `app/api/support/generate/route.ts`, `lib/knowledge/ingest.ts`

### n8n
- **Self-hosted** instance
- **Connects to app via:** HTTP requests to `/api/support/generate` and `/api/integrations/gmail/active`
- **Auth:** Bearer token from Supabase sign-in (n8n@sequenceflow.local machine user)
- **Machine user tenant:** `d59d02a8` (Tenant 41c329c0) — separate from real customer tenants
- **Workflow file:** `app/SupportFlow OS2current.json` — must be manually imported into n8n

---

## 7. KNOWN BUGS & TODO

### High Priority

| # | Bug / Task | Details |
|---|-----------|---------|
| H1 | **Tickets not appearing in inbox** | Workflow fix deployed 2026-03-17. Needs `SupportFlow OS2current.json` re-imported into n8n and a test email to verify. |
| H2 | **Lakatosco tenant not being processed** | No Gmail messages found in lakatosco inbox, or filterGate blocking all emails. Needs a fresh test email sent to `lakatosco.info@gmail.com`. |
| H3 | **SUPABASE_SERVICE_ROLE_KEY not confirmed on Hostinger** | If missing, all admin client calls (ticket inserts, support_event inserts, tenant lookup) silently fail or throw. |
| H4 | **NEXT_PUBLIC_SUPABASE_ANON_KEY not confirmed on Hostinger** | May cause "No API key found" browser errors. |

### Medium Priority

| # | Bug / Task | Details |
|---|-----------|---------|
| M1 | **`/inbox/[id]` page not audited** | Unknown if it works; ticket detail view not tested. |
| M2 | **knowledge_documents uses `client_id` not `tenant_id`** | Legacy naming inconsistency; not migrated. Works but confusing. |
| M3 | **Team tab is a placeholder** | Settings → Team shows no real data. `tenant_members` populated but UI not built. |
| M4 | **Dashboard page not audited** | Contents unknown. |
| M5 | **n8n workflow must be manually reimported** | Every change to `SupportFlow OS2current.json` requires manual import into n8n. No webhook or auto-sync. |
| M6 | **`agent_config` table is dead code** | Old global config table; RLS enabled with no policies (deny all). Can be dropped. |
| M7 | **`knowledge_ingest_jobs` table not in pg_tables results** | Defined in migration 002 but may not have been run. |

### Low Priority

| # | Bug / Task | Details |
|---|-----------|---------|
| L1 | **Bol.com integration is placeholder** | Settings → Integrations shows "SOON" disabled button. |
| L2 | **Confidence threshold field in Settings → Policy** | Input exists in UI but not wired to API; value not saved/loaded. |
| L3 | **Router and Template nodes orphaned in n8n** | Still present in workflow JSON but disconnected. Cleanup would reduce confusion. |
| L4 | **`lib/supabase.ts` and `lib/supabaseAdmin.ts` are near-identical** | Both use service role key. Could be deduplicated. |

---

## 8. ENVIRONMENT VARIABLES

All must be set in Hostinger's environment variable panel:

```
# Supabase (server-side)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY

# Supabase (client-side — baked in at build time)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# OpenAI
OPENAI_API_KEY

# Google OAuth
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

> ⚠️ `NEXT_PUBLIC_*` variables are baked into the JS bundle at build time. Changing them requires a full redeploy.

---

## 9. MULTI-TENANT STATUS

### What's Implemented
- ✅ `tenants` table with unique IDs per customer
- ✅ `tenant_members` maps users to tenants (supports multi-user teams)
- ✅ RLS on all tables enforces tenant isolation at database level
- ✅ All API routes resolve tenant via `getTenantId()` from JWT/cookie
- ✅ n8n sends `tenant_id` in request body; generate route uses body tenant over auth tenant
- ✅ Gmail tokens stored per-tenant in `tenant_integrations`
- ✅ Agent config stored per-tenant in `tenant_agent_config`
- ✅ Tickets stored per-tenant; inbox queries by tenant_id
- ✅ Knowledge docs scoped by `client_id` (= tenant_id)

### What's Missing / Incomplete
- ❌ **No auto-tenant-assignment on signup** — new Google OAuth users are not automatically assigned a tenant. Assignment is manual or via invite flow (not implemented).
- ❌ **No invite flow** — no way to add a second user to an existing tenant
- ❌ **Team tab UI** — `tenant_members` data exists but the Settings → Team page shows a placeholder
- ❌ **Admin panel** — no super-admin view across all tenants
- ❌ **Tenant onboarding** — no self-serve signup flow; tenants created manually in Supabase

### Current Active Tenants
| Tenant ID | Name | Gmail | User |
|-----------|------|-------|------|
| `33cfca3d` | sequenceflownl | sequenceflownl@gmail.com (active) | Sequence Flow |
| `f7333afb` | lakatosco | lakatosco.info@gmail.com (active) | Lakatos&Co |
| `d3f9e8a9` | — | none | nralf1996@gmail.com |
| `52d5c6db` | — | none | noctisessentials@gmail.com |
| `98a0b693` | — | none | deadtheon@gmail.com |

---

## 10. RECENT CHANGES (last 10 commits)

| Hash | Change |
|------|--------|
| `ca2559f` | Route all emails through AI/generate endpoint — Template node bypass removed; all intents now hit the generate endpoint which handles template selection internally |
| `2edaaef` | Use admin client for support_events inserts — RLS was blocking inserts after migration 009 |
| `d7c10df` | Use admin client for tenant lookup — Bearer token path had auth.uid() = NULL under RLS |
| `7a95493` | Enable RLS on all public tables — added tenant isolation policies to all 11 previously unrestricted tables |
| `f2bddaf` | Use admin client for ticket inserts — n8n machine user tenant ≠ processed tenant, RLS blocked inserts |
| `211ca9c` | Settings page: load config on mount + save button feedback — signature was disappearing on refresh |
| `7937c7e` | Disable HTML caching in next.config.ts — prevents stale chunk 404 errors after Hostinger redeploys |
| `6891346` | Logout uses window.location.href — prevents ChunkLoadError when navigating post-deploy |
| `cfdbb84` | Remove headerBlob from filterGate — Gmail headers contained "unsubscribe" etc., blocking legit emails |
| `106b0c1` | Use insert (not upsert) for tickets — no unique constraint on gmail_message_id, upsert was failing silently |
