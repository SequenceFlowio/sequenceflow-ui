# Commerce Intelligence Pilot Runbook

## Pilot boundary

The v1 pilot supports WooCommerce order context and full-order cancellation only. Shopify is shown as coming soon. Every reply remains human-reviewed and every cancellation requires approval by a tenant admin. Returns, line-item refunds, discounts, manual inventory changes, carriers, and autonomous actions remain out of scope.

## 1. Intake

Record the merchant's cancellation policy, refund method, restock exceptions, shop currency, maximum approval amount, and responsible tenant admins. Confirm that fulfilled and partially fulfilled orders are excluded. Choose a development or pilot shop and create at least one paid, unfulfilled, safely cancellable test order.

Exit evidence: signed policy values, named admins, test-shop domain, and test-order identifier.

## 2. Connect

Connect the support mailbox and review Agent DNA. In WordPress, create a read/write key under WooCommerce → Settings → Advanced → REST API. Enter the public HTTPS store URL, consumer key, and consumer secret in SequenceFlow, then explicitly confirm that the key was created with Read/Write permission. Save, test, verify the three order webhooks, run the recent-order sync, and leave cancellation actions disabled until calibration passes.

Before testing, configure distinct `COMMERCE_CREDENTIAL_ENCRYPTION_KEY` and `COMMERCE_IDENTITY_HMAC_KEY` secrets and a public HTTPS application URL. The store must use WooCommerce REST API v3 with pretty permalinks and must accept HTTP Basic Authentication.

WooCommerce REST keys are store-wide rather than order-scoped. SequenceFlow deliberately calls only order, refund, data, system-status, and webhook endpoints, and never persists complete provider responses. Treat the key as a high-value credential and revoke it immediately when the pilot ends.

The connection test proves authenticated read access and webhook management. WooCommerce does not expose a dependable key-permission introspection response, so the admin confirmation and the controlled test-order cancellation are both required evidence for write access.

Exit evidence: active connection, dedicated encrypted credential and HMAC configuration, webhook registration, shop currency, and successful recent sync.

## 3. Calibrate

Mine historical sent mail and approve only reusable Agent DNA proposals. Build a replay set covering explicit order numbers, email-only matches, multiple candidates, already-cancelled orders, fulfilled orders, amount boundaries, missing scope, provider failure, and successful asynchronous cancellation.

Exit evidence: reviewed profile, replay results, documented false matches, and no draft claiming an unverified shipping, refund, or cancellation result.

## 4. Shadow mode

Process real mail with live commerce context while actions remain disabled. Compare SequenceFlow's linked order, proposed response, and hypothetical cancellation eligibility with the employee's actual handling. Correct order links manually when multiple candidates exist and review learning proposals without activating them automatically.

Exit evidence: context match rate, correction rate, median edit distance, missed-match list, and policy exceptions.

## 5. Review mode

Enable `approval_required` and set the maximum amount in shop currency. Agents may prepare replies; tenant admins review cancellation proposals. Before approval, verify order, amount, refund destination, restock behavior, and the irreversible-action warning. The reply stays blocked until WooCommerce reports a completed refund and cancelled order status.

On provider failure, keep the reply blocked, refresh live order context, inspect the concrete error, and retry only after the cause is corrected. Reject the proposal to move the case to a documented manual path.

Exit evidence: proposal, approver, policy snapshot, execution attempt, WooCommerce refund ID, final status, reply outcome, and complete ticket timeline.

## 6. Weekly operations review

Review commerce context match rate, correction rate, median edit distance, action approval rate, action success rate, seven-day repeat-contact rate, failed preflights, manual order selections, and SKU cancellation signals. Approve, edit, or reject Agent DNA learning proposals. Record policy changes as a new reviewed pilot decision before changing tenant settings.

## Live acceptance

Send a real test email that explicitly requests cancellation and identifies the test order. Confirm one unambiguous order link and current WooCommerce context. Have a tenant admin approve the proposal once, including a deliberate double-click/retry check. Verify in WooCommerce and the payment gateway that cancellation, original-payment refund, and restock happen exactly once. Confirm SequenceFlow changes the action to `succeeded`, prepares a fresh human-reviewed confirmation from live provider state, enables the reply only when confirmation status is `prepared`, sends it, and records action plus reply outcomes in the timeline and analytics.

After the reply is sent, run the read-only evidence verifier with the deployment environment loaded:

```bash
PILOT_TENANT_ID=<tenant-uuid> \
PILOT_CONVERSATION_ID=<conversation-uuid> \
npm run commerce:verify-pilot
```

The verifier checks the active approval policy, unique order link, single action execution, post-success reply, current WooCommerce cancelled/refunded state, refund fingerprint, and all webhook registrations. Attach manual evidence of the payment-gateway refund and inventory count before/after restock.

Do not expand autonomy until multiple weekly reviews show reliable matching, acceptable corrections, successful actions, and no cross-tenant or duplicate-mutation findings.
