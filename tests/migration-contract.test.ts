import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/028_commerce_intelligence_v1.sql", import.meta.url), "utf8");
const learningClaimFix = readFileSync(new URL("../supabase/migrations/029_fix_profile_learning_claim.sql", import.meta.url), "utf8");
const learningMetrics = readFileSync(new URL("../supabase/migrations/030_profile_learning_metrics.sql", import.meta.url), "utf8");
const runtimeAtomicity = readFileSync(new URL("../supabase/migrations/031_commerce_runtime_atomicity.sql", import.meta.url), "utf8");
const senderFilters = readFileSync(new URL("../supabase/migrations/032_tenant_sender_filters.sql", import.meta.url), "utf8");
const ticketArchive = readFileSync(new URL("../supabase/migrations/033_ticket_archive.sql", import.meta.url), "utf8");
const wooCommerceProvider = readFileSync(new URL("../supabase/migrations/034_woocommerce_provider.sql", import.meta.url), "utf8");
const commerceEventQueue = readFileSync(new URL("../supabase/migrations/035_commerce_event_retry_queue.sql", import.meta.url), "utf8");
const providerSafeDisconnect = readFileSync(new URL("../supabase/migrations/036_provider_safe_disconnect.sql", import.meta.url), "utf8");
const commerceDataRetention = readFileSync(new URL("../supabase/migrations/037_commerce_data_retention.sql", import.meta.url), "utf8");
const commerceTenantIntegrity = readFileSync(new URL("../supabase/migrations/038_commerce_tenant_integrity.sql", import.meta.url), "utf8");
const activeCaseActionRetention = readFileSync(new URL("../supabase/migrations/039_active_case_action_retention.sql", import.meta.url), "utf8");
const cancellationConfirmationQueue = readFileSync(new URL("../supabase/migrations/040_cancellation_confirmation_queue.sql", import.meta.url), "utf8");
const tables = [
  "profile_learning_events",
  "commerce_connections",
  "commerce_orders",
  "commerce_order_items",
  "commerce_fulfillments",
  "conversation_entity_links",
  "commerce_events",
  "commerce_action_proposals",
  "commerce_action_executions",
  "operational_outcomes",
  "case_memories",
  "operational_metrics_daily",
  "commerce_audit_events",
];

test("commerce migration enables RLS and tenant policies for every new table", () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, "i"));
    assert.match(migration, new RegExp(`['\"]${table}['\"]`));
  }
  assert.match(migration, /tenant_id uuid NOT NULL REFERENCES tenants\(id\) ON DELETE CASCADE/);
});

test("commerce migration contains idempotency and worker indexes", () => {
  assert.match(migration, /preserve_support_decision_ai_draft[\s\S]+draft_body_ai is immutable once set/);
  assert.match(migration, /BEFORE UPDATE OF draft_body_ai ON support_decisions/);
  assert.match(migration, /record_action_proposed_outcome[\s\S]+AFTER INSERT ON commerce_action_proposals/);
  assert.match(migration, /UNIQUE \(tenant_id, action_fingerprint\)/);
  assert.match(migration, /UNIQUE \(connection_id, provider_event_id\)/);
  assert.match(migration, /idx_commerce_events_failed[\s\S]+WHERE status = 'failed'/);
  assert.match(migration, /idx_commerce_actions_pending[\s\S]+WHERE status IN \('approved', 'executing', 'failed'\)/);
  assert.match(migration, /idx_case_memories_expiry ON case_memories \(expires_at\)/);
  assert.match(migration, /link_status text NOT NULL DEFAULT 'linked' CHECK \(link_status IN \('candidate', 'linked'\)\)/);
  assert.match(migration, /UNIQUE \(source_conversation_id\)/);
  assert.match(migration, /idx_profile_learning_retention ON profile_learning_events \(created_at\)/);
  assert.match(migration, /idx_profile_learning_processing[\s\S]+WHERE status IN \('processing', 'failed'\)/);
  assert.match(migration, /idx_profile_learning_content_hash[\s\S]+WHERE content_hash IS NOT NULL AND origin = 'learning'/);
  assert.match(migration, /idx_commerce_audit_retention ON commerce_audit_events \(created_at\)/);
  assert.match(migration, /match_profile_fact_candidates[\s\S]+status IN \('approved', 'proposed'\)/);
  assert.match(migration, /replace_commerce_order_children[\s\S]+pg_advisory_xact_lock/);
  assert.match(migration, /claim_profile_learning_decisions[\s\S]+FOR UPDATE OF decision SKIP LOCKED/);
});

test("90-day case deletion preserves long-term action and learning metadata", () => {
  assert.match(migration, /decision_id uuid NOT NULL,/);
  assert.match(migration, /conversation_id uuid REFERENCES support_conversations\(id\) ON DELETE SET NULL/);
  assert.match(migration, /order_id uuid REFERENCES commerce_orders\(id\) ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /decision_id uuid NOT NULL REFERENCES support_decisions\(id\) ON DELETE CASCADE/);
});

test("learning queue claim removes PL/pgSQL output-column ambiguity", () => {
  assert.match(learningClaimFix, /ON CONFLICT ON CONSTRAINT profile_learning_events_decision_id_key/);
  assert.match(learningClaimFix, /RETURNING learning_event\.id, learning_event\.decision_id, learning_event\.tenant_id/);
  assert.match(learningClaimFix, /v_limit integer := LEAST\(100, GREATEST\(0, COALESCE\(p_limit, 30\)\)\)/);
});

test("Agent DNA metrics aggregate the complete tenant learning set", () => {
  assert.match(learningMetrics, /profile_learning_metrics\(p_tenant_id uuid\)/);
  assert.match(learningMetrics, /percentile_cont\(0\.5\) WITHIN GROUP/);
  assert.match(learningMetrics, /WHERE tenant_id = p_tenant_id/);
});

test("commerce action state, evidence, and lifecycle outcomes finalize atomically", () => {
  assert.match(runtimeAtomicity, /idx_operational_action_lifecycle_once/);
  assert.match(runtimeAtomicity, /AFTER UPDATE OF status ON commerce_action_proposals/);
  assert.match(runtimeAtomicity, /finalize_commerce_action_execution/);
  assert.match(runtimeAtomicity, /UPDATE commerce_action_executions[\s\S]+UPDATE commerce_action_proposals/);
  assert.match(runtimeAtomicity, /GRANT EXECUTE ON FUNCTION finalize_commerce_action_execution[\s\S]+TO service_role/);
});

test("manual link and action rejection transitions are transaction-bound", () => {
  assert.match(runtimeAtomicity, /confirm_conversation_order_link[\s\S]+DELETE FROM conversation_entity_links[\s\S]+INSERT INTO conversation_entity_links/);
  assert.match(runtimeAtomicity, /reject_commerce_action[\s\S]+UPDATE commerce_action_proposals[\s\S]+UPDATE support_decisions/);
  assert.match(runtimeAtomicity, /REVOKE ALL ON FUNCTION profile_learning_metrics\(uuid\) FROM PUBLIC, anon, authenticated/);
});

test("sender filters are tenant-isolated and ticket ignoring is transactional", () => {
  assert.match(senderFilters, /CREATE TABLE IF NOT EXISTS tenant_sender_filters/);
  assert.match(senderFilters, /tenant_id uuid NOT NULL REFERENCES tenants\(id\) ON DELETE CASCADE/);
  assert.match(senderFilters, /UNIQUE \(tenant_id, email\)/);
  assert.match(senderFilters, /ALTER TABLE tenant_sender_filters ENABLE ROW LEVEL SECURITY/);
  assert.match(senderFilters, /CREATE POLICY tenant_select ON tenant_sender_filters/);
  assert.match(senderFilters, /ignore_support_ticket[\s\S]+FOR UPDATE/);
  assert.match(senderFilters, /blocking_action_id IS NOT NULL/);
  assert.match(senderFilters, /SET status = 'ignored', scheduled_send_at = NULL/);
  assert.match(senderFilters, /REVOKE ALL ON FUNCTION ignore_support_ticket[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(senderFilters, /GRANT EXECUTE ON FUNCTION ignore_support_ticket[\s\S]+TO service_role/);
});

test("ticket archiving is reversible, tenant-bound, and commerce-aware", () => {
  assert.match(ticketArchive, /support_conversations_status_check[\s\S]+['"]archived['"]/);
  assert.match(ticketArchive, /tickets_status_check[\s\S]+['"]archived['"]/);
  assert.match(ticketArchive, /ADD COLUMN IF NOT EXISTS archived_at timestamptz/);
  assert.match(ticketArchive, /ADD COLUMN IF NOT EXISTS archived_from_status text/);
  assert.match(ticketArchive, /support_conversations_archive_state_check/);
  assert.match(ticketArchive, /tickets_archive_state_check/);
  assert.match(ticketArchive, /set_ticket_archived[\s\S]+tenant_id = p_tenant_id[\s\S]+FOR UPDATE/);
  assert.match(ticketArchive, /blocking_action_id IS NOT NULL/);
  assert.match(ticketArchive, /scheduled_send_at = NULL/);
  assert.match(ticketArchive, /archived_from_status IN \('open', 'review', 'sent', 'escalated', 'ignored', 'closed'\)/);
  assert.match(ticketArchive, /REVOKE ALL ON FUNCTION set_ticket_archived[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(ticketArchive, /GRANT EXECUTE ON FUNCTION set_ticket_archived[\s\S]+TO service_role/);
  assert.match(ticketArchive, /ignore_support_ticket[\s\S]+SET status = 'archived'/);
});

test("WooCommerce is allowed without weakening provider constraints", () => {
  assert.match(wooCommerceProvider, /commerce_connections_provider_check[\s\S]+provider IN \('shopify', 'woocommerce'\)/);
  assert.match(wooCommerceProvider, /commerce_orders_provider_check[\s\S]+provider IN \('shopify', 'woocommerce'\)/);
});

test("commerce webhook retries are leased, bounded, and service-role only", () => {
  assert.match(commerceEventQueue, /status IN \('pending', 'processing', 'processed', 'failed'\)/);
  assert.match(commerceEventQueue, /idx_commerce_events_retry_queue[\s\S]+attempts < 10/);
  assert.match(commerceEventQueue, /claim_commerce_events[\s\S]+FOR UPDATE OF event SKIP LOCKED/);
  assert.match(commerceEventQueue, /processing_started_at < now\(\) - interval '10 minutes'/);
  assert.match(commerceEventQueue, /REVOKE ALL ON FUNCTION claim_commerce_events\(integer\) FROM PUBLIC, anon, authenticated/);
  assert.match(commerceEventQueue, /GRANT EXECUTE ON FUNCTION claim_commerce_events\(integer\) TO service_role/);
});

test("commerce disconnect is atomic and scoped to one provider", () => {
  assert.match(providerSafeDisconnect, /disconnect_commerce_connection/);
  assert.match(providerSafeDisconnect, /order_record\.connection_id = v_connection_id/);
  assert.match(providerSafeDisconnect, /proposal\.status = 'executing'/);
  assert.match(providerSafeDisconnect, /FOR UPDATE OF proposal/);
  assert.match(providerSafeDisconnect, /DELETE FROM commerce_connections[\s\S]+provider = p_provider/);
  assert.match(providerSafeDisconnect, /REVOKE ALL ON FUNCTION disconnect_commerce_connection\(uuid, text\)/);
  assert.match(providerSafeDisconnect, /GRANT EXECUTE ON FUNCTION disconnect_commerce_connection\(uuid, text\)[\s\S]+TO service_role/);
});

test("normalized commerce PII expires only after active-case and action guards", () => {
  assert.match(commerceDataRetention, /DELETE FROM mined_exchanges/);
  assert.match(commerceDataRetention, /UPDATE mining_jobs[\s\S]+Restart mining after privacy hardening/);
  assert.match(commerceDataRetention, /DELETE FROM tenant_profile_facts[\s\S]+origin = 'mining' AND kind = 'exemplar'/);
  assert.match(commerceDataRetention, /UPDATE tenant_profile_facts[\s\S]+SET source_refs = NULL/);
  assert.match(commerceDataRetention, /idx_commerce_orders_retention[\s\S]+COALESCE\(provider_updated_at, order_created_at\)/);
  assert.match(commerceDataRetention, /idx_commerce_actions_order_open[\s\S]+WHERE order_id IS NOT NULL/);
  assert.match(commerceDataRetention, /prune_expired_commerce_orders/);
  assert.match(commerceDataRetention, /provider_updated_at, order_record\.order_created_at/);
  assert.match(commerceDataRetention, /conversation\.retention_exempt = true/);
  assert.match(commerceDataRetention, /conversation\.latest_message_at >= p_cutoff/);
  assert.match(commerceDataRetention, /proposal\.status IN \('proposed', 'approved', 'executing', 'failed', 'blocked'\)/);
  assert.match(commerceDataRetention, /REVOKE ALL ON FUNCTION prune_expired_commerce_orders\(timestamptz\)/);
  assert.match(commerceDataRetention, /GRANT EXECUTE ON FUNCTION prune_expired_commerce_orders\(timestamptz\)[\s\S]+TO service_role/);
});

test("commerce relationships enforce tenant ownership in the database", () => {
  for (const relationship of [
    "commerce_orders_tenant_connection_fk",
    "commerce_order_items_tenant_order_fk",
    "commerce_fulfillments_tenant_order_fk",
    "conversation_entity_links_tenant_conversation_fk",
    "conversation_entity_links_tenant_order_fk",
    "commerce_events_tenant_connection_fk",
    "commerce_events_tenant_order_fk",
    "commerce_actions_tenant_conversation_fk",
    "commerce_actions_tenant_decision_fk",
    "commerce_actions_tenant_order_fk",
    "commerce_executions_tenant_proposal_fk",
    "operational_outcomes_tenant_conversation_fk",
    "operational_outcomes_tenant_order_fk",
    "operational_outcomes_tenant_action_fk",
    "case_memories_tenant_conversation_fk",
    "support_decisions_tenant_blocking_action_fk",
  ]) {
    assert.match(commerceTenantIntegrity, new RegExp(relationship), relationship);
  }
  assert.match(commerceTenantIntegrity, /FOREIGN KEY \(tenant_id, conversation_id, decision_id\)/);
  assert.match(commerceTenantIntegrity, /FOREIGN KEY \(tenant_id, id, blocking_action_id\)/);
});

test("long-term action cleanup never unblocks an active or retained case", () => {
  assert.match(activeCaseActionRetention, /prune_expired_commerce_actions/);
  assert.match(activeCaseActionRetention, /conversation\.retention_exempt = true/);
  assert.match(activeCaseActionRetention, /conversation\.status NOT IN \('sent', 'closed', 'ignored', 'escalated', 'archived'\)/);
  assert.match(activeCaseActionRetention, /REVOKE ALL ON FUNCTION prune_expired_commerce_actions\(timestamptz\)/);
  assert.match(activeCaseActionRetention, /GRANT EXECUTE ON FUNCTION prune_expired_commerce_actions\(timestamptz\)[\s\S]+TO service_role/);
  const cleanup = readFileSync(new URL("../app/api/cron/cleanup-old-email/route.ts", import.meta.url), "utf8");
  assert.match(cleanup, /rpc\("prune_expired_commerce_actions"/);
  assert.doesNotMatch(cleanup, /from\("commerce_action_proposals"\)\.delete\(\)\.lt\("created_at", longTermCutoff\)/);
});

test("cancellation confirmations are durable, tenant-bound, and claimed once", () => {
  assert.match(cancellationConfirmationQueue, /confirmation_status IN \('pending', 'preparing', 'prepared', 'failed'\)/);
  assert.match(cancellationConfirmationQueue, /confirmation_attempts >= 0 AND confirmation_attempts <= 5/);
  assert.match(cancellationConfirmationQueue, /FOREIGN KEY \(tenant_id, confirmation_decision_id\)/);
  assert.match(cancellationConfirmationQueue, /claim_cancellation_confirmations[\s\S]+FOR UPDATE OF proposal SKIP LOCKED/);
  assert.match(cancellationConfirmationQueue, /confirmation_processing_started_at < now\(\) - interval '10 minutes'/);
  assert.match(cancellationConfirmationQueue, /REVOKE ALL ON FUNCTION claim_cancellation_confirmations\(integer\)[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(cancellationConfirmationQueue, /GRANT EXECUTE ON FUNCTION claim_cancellation_confirmations\(integer\)[\s\S]+TO service_role/);
});
