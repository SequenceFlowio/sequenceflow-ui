import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { recordCommerceAudit } from "@/lib/commerce/audit";
import { commercePermissionIssue } from "@/lib/commerce/adapter";
import { disconnectCommerceConnection, loadCommerceConnection } from "@/lib/commerce/connections";
import { WooCommerceAdapter } from "@/lib/commerce/woocommerce";
import { normalizeWooCommerceUrl } from "@/lib/commerce/woocommerceHttp";
import { encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const connection = await loadCommerceConnection(context.tenantId, true, "woocommerce");
    return NextResponse.json({ connection: connection ? {
      provider: connection.provider, shopDomain: connection.shopDomain, status: connection.status,
      clientId: connection.clientId, scopes: connection.scopes, actionMode: connection.actionMode,
      maxCancelAmount: connection.maxCancelAmount, shopCurrency: connection.shopCurrency,
      hasSecret: Boolean(connection.clientSecretEncrypted),
    } : null });
  } catch (error) { const auth = authorizationErrorResponse(error); return NextResponse.json({ error: auth.message }, { status: auth.status }); }
}

export async function POST(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const body = await req.json().catch(() => ({})) as { shopDomain?: unknown; consumerKey?: unknown; consumerSecret?: unknown; confirmWriteAccess?: unknown };
    const shopDomain = normalizeWooCommerceUrl(String(body.shopDomain ?? ""));
    const consumerKey = String(body.consumerKey ?? "").trim();
    const consumerSecret = String(body.consumerSecret ?? "").trim();
    if (!/^ck_[a-zA-Z0-9]+$/.test(consumerKey)) return NextResponse.json({ error: "A valid WooCommerce consumer key is required." }, { status: 400 });
    if (consumerSecret && !/^cs_[a-zA-Z0-9]+$/.test(consumerSecret)) return NextResponse.json({ error: "A valid WooCommerce consumer secret is required." }, { status: 400 });
    if (body.confirmWriteAccess !== true) return NextResponse.json({ error: "Confirm that the WooCommerce key has Read/Write permissions." }, { status: 400 });
    const existing = await loadCommerceConnection(context.tenantId, true, "woocommerce");
    if (!consumerSecret && !existing?.clientSecretEncrypted) return NextResponse.json({ error: "Consumer secret is required." }, { status: 400 });
    await recordCommerceAudit({ tenantId: context.tenantId, actorUserId: context.userId, eventType: "connection_save_requested", targetType: "connection", targetId: existing?.id ?? null, metadata: { provider: "woocommerce", shopDomain, replacingSecret: Boolean(consumerSecret) } });
    const { error } = await getSupabaseAdmin().from("commerce_connections").upsert({
      tenant_id: context.tenantId, provider: "woocommerce", shop_domain: shopDomain, client_id: consumerKey,
      client_secret_encrypted: consumerSecret ? encryptSecret(consumerSecret) : existing!.clientSecretEncrypted,
      access_token_encrypted: existing?.accessTokenEncrypted ?? encryptSecret(randomBytes(32).toString("base64url")),
      token_expires_at: null, scopes: [], status: "test_required", action_mode: "disabled", last_error: null, updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "test_required" });
  } catch (error) { const auth = authorizationErrorResponse(error); return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status: auth.status === 401 ? 401 : 400 }); }
}

export async function PATCH(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const body = await req.json().catch(() => ({})) as { actionMode?: unknown; maxCancelAmount?: unknown; status?: unknown };
    const existing = await loadCommerceConnection(context.tenantId, true, "woocommerce");
    if (!existing) return NextResponse.json({ error: "WooCommerce connection not found." }, { status: 404 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.actionMode === "disabled") update.action_mode = "disabled";
    if (body.actionMode === "approval_required") {
      const issue = commercePermissionIssue(existing);
      if (existing.status !== "active" || issue) return NextResponse.json({ error: issue || "Test WooCommerce before enabling actions." }, { status: 409 });
      update.action_mode = "approval_required";
    }
    if (body.status === "paused") {
      if (existing.status !== "active") return NextResponse.json({ error: "Only an active connection can be paused." }, { status: 409 });
      update.status = "paused";
    }
    if (body.status === "active") {
      const issue = commercePermissionIssue(existing);
      if (existing.status !== "paused" || issue) return NextResponse.json({ error: issue || "Only a tested, paused connection can be resumed." }, { status: 409 });
      update.status = "active";
    }
    if (body.maxCancelAmount !== undefined) {
      const amount = Number(body.maxCancelAmount);
      if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Invalid cancellation limit." }, { status: 400 });
      update.max_cancel_amount = amount;
    }
    await recordCommerceAudit({ tenantId: context.tenantId, actorUserId: context.userId, eventType: "connection_update_requested", targetType: "connection", targetId: existing.id, metadata: { provider: "woocommerce", actionMode: update.action_mode ?? null, status: update.status ?? null, maxCancelAmount: update.max_cancel_amount ?? null } });
    const { error } = await getSupabaseAdmin().from("commerce_connections").update(update).eq("tenant_id", context.tenantId).eq("provider", "woocommerce");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) { const auth = authorizationErrorResponse(error); return NextResponse.json({ error: auth.message }, { status: auth.status }); }
}

export async function DELETE(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const connection = await loadCommerceConnection(context.tenantId, true, "woocommerce");
    await recordCommerceAudit({ tenantId: context.tenantId, actorUserId: context.userId, eventType: "connection_disconnect_requested", targetType: "connection", targetId: connection?.id ?? null, metadata: { provider: "woocommerce", shopDomain: connection?.shopDomain ?? null } });
    await disconnectCommerceConnection(context.tenantId, "woocommerce");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    if (connection && appUrl.startsWith("https://")) await new WooCommerceAdapter().unregisterWebhooks(connection, `${appUrl}/api/integrations/woocommerce/webhook`).catch((error) => console.error("[woocommerce/disconnect]", error));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authorizationErrorResponse(error); const message = error instanceof Error ? error.message : auth.message;
    return NextResponse.json({ error: message }, { status: /executing action/i.test(message) ? 409 : auth.status });
  }
}
