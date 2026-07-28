import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("commerce administration and action mutations are admin-bound", () => {
  for (const path of [
    "app/api/integrations/bol/route.ts",
    "app/api/integrations/bol/test/route.ts",
    "app/api/integrations/bol/sync/route.ts",
    "app/api/integrations/bol/mailbox/verify/route.ts",
    "app/api/integrations/shopify/route.ts",
    "app/api/integrations/shopify/test/route.ts",
    "app/api/integrations/shopify/sync/route.ts",
    "app/api/integrations/woocommerce/route.ts",
    "app/api/integrations/woocommerce/test/route.ts",
    "app/api/integrations/woocommerce/sync/route.ts",
    "app/api/commerce-actions/[id]/approve/route.ts",
    "app/api/commerce-actions/[id]/reject/route.ts",
    "app/api/commerce-actions/[id]/retry/route.ts",
  ]) {
    assert.match(source(path), /requireRole\(await getTenantId\(req\), \["admin"\]\)/, path);
  }
});

test("action and order identifiers remain tenant- and candidate-bound", () => {
  for (const path of [
    "app/api/commerce-actions/[id]/approve/route.ts",
    "app/api/commerce-actions/[id]/reject/route.ts",
  ]) {
    assert.match(source(path), /(?:\.eq\("tenant_id", context\.tenantId\)|p_tenant_id: context\.tenantId)/, path);
  }
  const contextRoute = source("app/api/tickets/[id]/commerce-context/route.ts");
  assert.match(contextRoute, /isVerifiedOrderCandidate/);
  assert.match(contextRoute, /loadOrderContext\(context\.tenantId, orderId\)/);
  assert.match(contextRoute, /confirm_conversation_order_link/);
  assert.match(contextRoute, /p_user_id: context\.userId/);
  const resolution = source("lib/commerce/resolution.ts");
  assert.match(resolution, /orderCustomerIdentityMatches/);
  assert.match(resolution, /autoLinkAllowed[\s\S]+customerIdentityMatched/);
  assert.match(resolution, /match_method", "manual"[\s\S]+confirmed_at[\s\S]+getOrder\(linkedConnection/);
  assert.match(resolution, /humanConfirmed: true/);
});

test("provider execution and manual resolution use atomic database transitions", () => {
  assert.match(source("lib/commerce/actions.ts"), /finalize_commerce_action_execution/);
  const actionWorker = source("app/api/cron/commerce-action-worker/route.ts");
  assert.match(actionWorker, /finalizeCommerceActionExecution/);
  assert.match(actionWorker, /eq\("status", "approved"\)[\s\S]+limit\(1\)[\s\S]+executeCancellation/);
  assert.match(actionWorker, /commercePermissionIssue/);
  assert.match(actionWorker, /evaluateCancellationRetry/);
  assert.match(actionWorker, /woocommerce_reconciliation_preflight/);
  assert.match(source("app/api/commerce-actions/[id]/reject/route.ts"), /reject_commerce_action/);
  assert.doesNotMatch(source("app/api/cron/commerce-action-worker/route.ts"), /from\("operational_outcomes"\)/);
});

test("orders stay bound to their own provider connection", () => {
  const actions = source("lib/commerce/actions.ts");
  const actionWorker = source("app/api/cron/commerce-action-worker/route.ts");
  const contextRoute = source("app/api/tickets/[id]/commerce-context/route.ts");
  const resolution = source("lib/commerce/resolution.ts");

  assert.match(actions, /reloadCommerceConnection\(order\.connectionId\)/);
  assert.match(actions, /reloadCommerceConnection\(storedOrder\.connectionId\)/);
  assert.match(actionWorker, /reloadCommerceConnection\(storedOrder\.connectionId\)/);
  assert.match(contextRoute, /reloadCommerceConnection\(commerce\.order\.connectionId\)/);
  assert.match(resolution, /reloadCommerceConnection\(order\.connectionId\)/);
  assert.match(resolution, /candidate\.connectionId === connection\.id/);
  for (const path of [
    "app/api/integrations/woocommerce/route.ts",
    "app/api/integrations/shopify/route.ts",
  ]) {
    assert.match(source(path), /pausedProviderMessage\("(?:woocommerce|shopify)"\)/, path);
    assert.match(source(path), /export const POST = blocked/, path);
    assert.match(source(path), /export const DELETE = blocked/, path);
  }
});

test("all reply paths require provider success and a prepared confirmation", () => {
  for (const path of [
    "app/api/tickets/[id]/approve-send/route.ts",
    "app/api/tickets/[id]/schedule-send/route.ts",
    "app/api/cron/autosend/route.ts",
  ]) {
    assert.match(source(path), /blockingActionAllowsReply\(blockingAction\?\.status, blockingAction\?\.confirmation_status\)/, path);
  }
});

test("confirmation retries cannot repeat a succeeded provider mutation", () => {
  const retry = source("app/api/commerce-actions/[id]/retry/route.ts");
  const worker = source("app/api/cron/commerce-action-worker/route.ts");
  const pipeline = source("lib/pipeline/runInboundEmailPipeline.ts");
  assert.match(retry, /action\.status === "succeeded"[\s\S]+confirmation_status: "pending"[\s\S]+return NextResponse\.json/);
  assert.match(worker, /claim_cancellation_confirmations/);
  assert.match(worker, /prepareCancellationConfirmation/);
  assert.match(worker, /confirmation_status: "failed"/);
  assert.match(pipeline, /forceHumanReview[\s\S]+actions: \[\]/);
  assert.match(pipeline, /commerceProviderActionsAllowed\(commerceResolution\.provider\)[\s\S]+actions: \[\]/);
  assert.match(pipeline, /blocking_action_id: input\.linkedSucceededActionId/);
});

test("commerce mutations register sanitized audit events", () => {
  for (const path of [
    "app/api/integrations/bol/route.ts",
    "app/api/tickets/[id]/commerce-context/route.ts",
    "app/api/commerce-actions/[id]/approve/route.ts",
    "app/api/commerce-actions/[id]/reject/route.ts",
    "app/api/commerce-actions/[id]/retry/route.ts",
  ]) {
    assert.match(source(path), /recordCommerceAudit/, path);
    assert.doesNotMatch(
      source(path),
      /metadata:\s*\{[^}]*(?:clientSecret|accessToken|refreshToken|token)\s*:/,
      path,
    );
  }
});

test("retention never deletes a case whose memory preservation failed", () => {
  const cleanup = source("app/api/cron/cleanup-old-email/route.ts");
  const memory = source("lib/commerce/caseMemory.ts");
  assert.match(cleanup, /await preserveCaseMemory[\s\S]+conversationIds\.push\(conversation\.id\)[\s\S]+catch/);
  assert.match(cleanup, /\.in\("id", conversationIds\)/);
  assert.match(memory, /memoryError[\s\S]+throw new Error\(`Could not preserve case memory/);
  assert.match(cleanup, /longTermCleanup[\s\S]+longTermError[\s\S]+status: 500/);
  assert.match(cleanup, /rpc\("prune_expired_commerce_orders"[\s\S]+commerceRetentionError[\s\S]+status: 500/);
  assert.match(cleanup, /from\("translation_cache"\)\.delete\(\)\.lt\("created_at", cutoff\)/);
  assert.match(cleanup, /from\("mined_exchanges"\)\.delete\(\)\.lt\("created_at", cutoff\)/);
});

test("Agent DNA mining pseudonymizes and removes temporary exchanges", () => {
  const worker = source("app/api/cron/mining-worker/route.ts");
  const distill = source("lib/mining/distillProfile.ts");
  assert.match(worker, /subject: normalizeLearningText\(message\.subject\)/);
  assert.match(worker, /customer_text: exchange\.customerText \? normalizeLearningText/);
  assert.match(worker, /facts: exchange\.facts\.flatMap[\s\S]+sanitizeReusableLearningRule/);
  assert.match(worker, /replyMessageId = learningContentHash/);
  assert.match(worker, /inbound_message_id: null/);
  assert.match(worker, /from\("mined_exchanges"\)[\s\S]+delete\(\)[\s\S]+eq\("job_id", job\.id\)/);
  assert.doesNotMatch(distill, /messageId: row\.reply_message_id/);
  assert.doesNotMatch(distill, /subject: row\.subject/);
});

test("Agent DNA review exposes a tenant-bound source ticket and learning evidence", () => {
  const route = source("app/api/agent-profile/route.ts");
  const page = source("app/(app)/agent-profile/page.tsx");
  assert.match(route, /support_decisions"\)\.select\("id,conversation_id"\)\.eq\("tenant_id", tenantId\)/);
  assert.match(route, /conversation_id: sourceConversationByDecision\.get/);
  assert.match(page, /href=\{`\/inbox\/\$\{event\.conversation_id\}`\}/);
  assert.match(page, /copy\.eventStatus\[event\.status\][\s\S]+event\.confidence/);
  assert.match(page, /event\.normalized_ai[\s\S]+event\.normalized_human/);
});

test("operational action rates use immutable lifecycle outcomes", () => {
  for (const path of [
    "app/api/analytics/operations/route.ts",
    "app/api/cron/operations-rollup/route.ts",
  ]) {
    const contents = source(path);
    assert.match(contents, /action_approved/, path);
    assert.match(contents, /action_succeeded/, path);
    assert.match(contents, /new Set/, path);
  }
  const rollup = source("app/api/cron/operations-rollup/route.ts");
  for (const table of ["commerce_connections", "commerce_action_proposals", "profile_learning_events", "operational_outcomes"]) {
    assert.match(rollup, new RegExp(`from\\("${table}"\\)\\.select\\("tenant_id"\\)`), table);
  }
});

test("ticket detail exposes the commerce contract and its action audit trail", () => {
  const route = source("app/api/tickets/[id]/route.ts");
  for (const field of ["commerceContext", "entityLinks", "blockingAction", "operationalTimeline"]) {
    assert.match(route, new RegExp(`${field}:`), field);
  }
  assert.match(route, /from\("commerce_audit_events"\)[\s\S]+eq\("target_type", "action"\)/);
  assert.match(route, /from\("commerce_audit_events"\)[\s\S]+eq\("target_type", "order_link"\)/);
  assert.match(route, /type: "audit_event"/);
});

test("a single unverified order remains manually selectable", () => {
  const panel = source("app/(app)/inbox/[id]/CommercePanel.tsx");
  assert.match(panel, /!order && context\.candidates\.length > 0/);
  assert.match(panel, /customer identity could not be verified automatically/);
});

test("Shopify disconnect explains pseudonymous retention honestly", () => {
  for (const path of ["lib/i18n/dictionaries/nl.ts", "lib/i18n/dictionaries/en.ts"]) {
    const contents = source(path);
    assert.match(contents, /shopifyDisconnectConfirm/);
    assert.match(contents, /24 (?:maanden|months)/, path);
  }
});

test("bol.com credentials are validated, encrypted, and never returned to the browser", () => {
  const route = source("app/api/integrations/bol/route.ts");
  assert.match(route, /requireRole\(await getTenantId\(req\), \["admin"\]\)/);
  assert.match(route, /encryptSecret\(clientSecret\)/);
  assert.match(route, /hasSecret: Boolean\(connection\.clientSecretEncrypted\)/);
  assert.doesNotMatch(route, /clientSecret:\s*connection\./);
  for (const path of [
    "app/api/integrations/shopify/test/route.ts",
    "app/api/integrations/woocommerce/test/route.ts",
  ]) {
    const route = source(path);
    assert.match(route, /pausedProviderMessage\("(?:shopify|woocommerce)"\)/, path);
    assert.match(route, /status: 409/, path);
  }
});

test("bol.com mailbox verification treats an empty inbox as pending, not broken", () => {
  const settings = source("app/(app)/settings/BolSettings.tsx");
  assert.match(settings, /key === "mailbox" && response\.status === 409/);
  assert.match(settings, /Klaar voor de eerste klantvraag/);
  assert.match(settings, /API, events en synchronisatie werken/);
});

test("bol.com setup explains that customer questions require the separate CRM email route", () => {
  const bolSettings = source("app/(app)/settings/BolSettings.tsx");
  const mailboxSettings = source("app/(app)/settings/SupportMailboxSettings.tsx");
  assert.match(bolSettings, /De API is klaar\. Klantvragen lopen apart via e-mail\./);
  assert.match(bolSettings, /bol\.com deelt orders, verzendingen en retouren via de API, maar geen klantgesprekken/);
  assert.match(bolSettings, /href="#support-mailbox"/);
  assert.match(mailboxSettings, /id="support-mailbox"/);
});

test("manual sender filtering runs before the built-in inbound filter", () => {
  const pipeline = source("lib/pipeline/runInboundEmailPipeline.ts");
  const lookupSource = source("lib/email/inbound/senderFilters.ts");
  const lookup = pipeline.indexOf("await isTenantSenderBlocked");
  const builtIn = pipeline.indexOf("filterInboundEmail(input.email", lookup);
  assert.ok(lookup >= 0 && builtIn > lookup);
  assert.match(pipeline, /reason: "Tenant sender filter"/);
  assert.match(lookupSource, /from\("tenant_sender_filters"\)/);
  assert.match(lookupSource, /eq\("tenant_id", tenantId\)\.eq\("email", email\)/);
  assert.match(lookupSource, /if \(error\) throw new Error/);
});

test("global sender filters are admin-bound and ticket-only ignore remains available to agents", () => {
  const filtersRoute = source("app/api/sender-filters/route.ts");
  assert.match(filtersRoute, /requireRole\(await getTenantId\(req\), \["admin"\]\)/);
  assert.match(filtersRoute, /eq\("tenant_id", context\.tenantId\)/);
  const ignoreRoute = source("app/api/tickets/[id]/ignore/route.ts");
  assert.match(ignoreRoute, /blockFuture && context\.role !== "admin"/);
  assert.match(ignoreRoute, /rpc\("ignore_support_ticket"/);
  assert.match(ignoreRoute, /p_tenant_id: context\.tenantId/);
});

test("archive routes are tenant-bound and permanent deletion requires archive", () => {
  const archiveRoute = source("app/api/tickets/[id]/archive/route.ts");
  const bulkArchiveRoute = source("app/api/tickets/bulk-archive/route.ts");
  const ticketRoute = source("app/api/tickets/[id]/route.ts");
  const inboxPage = source("app/(app)/inbox/page.tsx");

  assert.match(archiveRoute, /getTenantId\(req\)/);
  assert.match(archiveRoute, /rpc\("set_ticket_archived"/);
  assert.match(archiveRoute, /p_tenant_id: context\.tenantId/);
  assert.match(bulkArchiveRoute, /MAX_BULK_TICKETS = 100/);
  assert.match(bulkArchiveRoute, /p_tenant_id: context\.tenantId/);
  assert.match(ticketRoute, /\["archived", "spam"\]\.includes\(conversation\.status\)/);
  assert.match(ticketRoute, /\["archived", "spam"\]\.includes\(ticket\.status\)/);
  assert.match(inboxPage, /type Tab = "review" \| "sent" \| "escalated" \| "archived" \| "spam"/);
  assert.match(inboxPage, /fetch\("\/api\/tickets\/bulk-archive"/);
  assert.match(inboxPage, /if \(!selectionMode\) return;[\s\S]+event\.preventDefault\(\);[\s\S]+toggleTicketSelection\(ticket\.id\)/);
});

test("spam feedback is server-controlled and never mutates the provider mailbox", () => {
  const spamRoute = source("app/api/tickets/[id]/spam/route.ts");
  const spamControl = source("app/(app)/inbox/[id]/SpamControl.tsx");
  const pipeline = source("lib/pipeline/runInboundEmailPipeline.ts");
  const billing = source("lib/billing.ts");
  assert.match(spamRoute, /getTenantId\(req\)/);
  assert.match(spamRoute, /evaluateSpamRefund/);
  assert.match(spamRoute, /rpc\(rpc, args\)/);
  assert.match(spamRoute, /providerMessageUntouched: true/);
  assert.match(spamControl, /original stays with your email provider/i);
  assert.match(pipeline, /spam_feedback_events/);
  assert.match(pipeline, /subject: null[\s\S]+draft_text: null/);
  assert.match(billing, /\.not\("latest_decision_id", "is", null\)/);
  assert.match(billing, /\.or\("status\.neq\.spam,spam_billing_exempt\.eq\.false"\)/);
});

test("bol.com is the only visible and runtime-enabled commerce provider", () => {
  const wooRoute = source("app/api/integrations/woocommerce/route.ts");
  const shopifyRoute = source("app/api/integrations/shopify/route.ts");
  const wooWebhook = source("app/api/integrations/woocommerce/webhook/route.ts");
  const integrations = source("app/(app)/integrations/IntegrationsClient.tsx");
  const registry = source("lib/commerce/providers.ts");
  assert.match(wooRoute, /requireRole\(await getTenantId\(req\), \["admin"\]\)/);
  assert.match(wooRoute, /status: "paused"/);
  assert.match(shopifyRoute, /requireRole\(await getTenantId\(req\), \["admin"\]\)/);
  assert.match(shopifyRoute, /status: "paused"/);
  assert.match(wooWebhook, /verifyWooCommerceWebhook/);
  assert.match(wooWebhook, /ignored: true, reason: "provider_paused"/);
  const commercePanel = source("app/(app)/inbox/[id]/CommercePanel.tsx");
  assert.match(commercePanel, /context\.provider === "bol" \? "bol\.com"/);
  assert.match(integrations, /<BolSettings \/>/);
  assert.doesNotMatch(integrations, /<WooCommerceSettings \/>|<ShopifySettings \/>/);
  assert.match(registry, /bol:[\s\S]+visible: true,[\s\S]+runtimeEnabled: true,[\s\S]+actionsAllowed: false/);
  assert.match(registry, /shopify:[\s\S]+visible: false,[\s\S]+runtimeEnabled: false/);
  assert.match(registry, /woocommerce:[\s\S]+visible: false,[\s\S]+runtimeEnabled: false/);
});

test("bol.com setup guide covers API credentials, CRM email, and read-only verification", () => {
  const guide = source("app/(app)/settings/BolSettings.tsx");
  const testRoute = source("app/api/integrations/woocommerce/test/route.ts");
  assert.match(guide, /role="dialog"/);
  assert.match(guide, /Client ID/);
  assert.match(guide, /official CRM email integration/);
  assert.match(guide, /Read-only in v1/);
  assert.match(guide, /never cancels, returns, ships, or changes inventory/);
  assert.match(testRoute, /pausedProviderMessage\("woocommerce"\)/);
});

test("bol.com webhook uses the durable retry queue while paused providers only acknowledge", () => {
  const bolWebhook = source("app/api/integrations/bol/webhook/route.ts");
  const bolProvider = source("lib/commerce/bol.ts");
  assert.match(bolWebhook, /verifyBolSignature/);
  assert.match(bolWebhook, /signature_keys/);
  assert.match(bolWebhook, /bolEventId\(event\)/);
  assert.match(bolWebhook, /persistAndClaimCommerceEvent/);
  assert.match(bolWebhook, /processCommerceEvent/);
  assert.match(bolWebhook, /failCommerceEvent/);
  assert.match(bolProvider, /subscriptionType: "WEBHOOK"/);
  assert.match(bolProvider, /\/retailer\/subscriptions\/signature-keys/);
  for (const path of [
    "app/api/integrations/shopify/webhook/route.ts",
    "app/api/integrations/woocommerce/webhook/route.ts",
  ]) {
    const contents = source(path);
    assert.match(contents, /ignored: true, reason: "provider_paused"/, path);
    assert.doesNotMatch(contents, /persistAndClaimCommerceEvent/, path);
  }
  const worker = source("app/api/cron/commerce-event-worker/route.ts");
  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /claim_commerce_events/);
  assert.match(source("vercel.json"), /\/api\/cron\/commerce-event-worker/);
  assert.match(source("lib/commerce/events.ts"), /eq\("status", "pending"\)/);
  assert.doesNotMatch(source("lib/commerce/events.ts"), /in\("status", \["pending", "failed"\]\)/);
});

test("bol.com replies preserve the CRM reply address and remain read-only", () => {
  const pipeline = source("lib/pipeline/runInboundEmailPipeline.ts");
  const approve = source("app/api/tickets/[id]/approve-send/route.ts");
  const autosend = source("app/api/cron/autosend/route.ts");
  const resolution = source("lib/commerce/resolution.ts");
  assert.match(pipeline, /reply_to_email: input\.email\.replyTo/);
  assert.match(pipeline, /commerceProviderActionsAllowed[\s\S]+actions: \[\]/);
  assert.match(approve, /inboundMessage\.reply_to_email \|\| conversation\.customer_email/);
  assert.match(autosend, /msg\?\.reply_to_email \|\| conv\.customer_email/);
  assert.match(resolution, /actionsAllowed: \$\{resolution\.provider === "bol" \? "false \(read-only bol\.com v1\)"/);
});
