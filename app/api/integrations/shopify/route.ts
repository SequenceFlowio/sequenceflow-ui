import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { recordCommerceAudit } from "@/lib/commerce/audit";
import { disconnectCommerceConnection, loadCommerceConnection } from "@/lib/commerce/connections";
import { normalizeShopDomain, ShopifyAdapter } from "@/lib/commerce/shopify";
import { shopifyScopeIssue } from "@/lib/commerce/shopifyAuth";
import { encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const connection = await loadCommerceConnection(context.tenantId, true, "shopify");
    return NextResponse.json({ connection: connection ? {
      provider: connection.provider, shopDomain: connection.shopDomain, status: connection.status,
      clientId: connection.clientId,
      scopes: connection.scopes, actionMode: connection.actionMode, maxCancelAmount: connection.maxCancelAmount,
      shopCurrency: connection.shopCurrency, hasSecret: Boolean(connection.clientSecretEncrypted),
    } : null });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}

export async function POST(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const body = await req.json().catch(() => ({})) as { shopDomain?: unknown; clientId?: unknown; clientSecret?: unknown };
    const shopDomain = normalizeShopDomain(String(body.shopDomain ?? ""));
    const clientId = String(body.clientId ?? "").trim();
    const clientSecret = String(body.clientSecret ?? "").trim();
    if (!clientId) return NextResponse.json({ error: "Client ID is required." }, { status: 400 });
    const existing = await loadCommerceConnection(context.tenantId, true, "shopify");
    if (!clientSecret && !existing?.clientSecretEncrypted) return NextResponse.json({ error: "Client secret is required." }, { status: 400 });
    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "connection_save_requested",
      targetType: "connection", targetId: existing?.id ?? null,
      metadata: { provider: "shopify", shopDomain, replacingSecret: Boolean(clientSecret) },
    });
    const { error } = await getSupabaseAdmin().from("commerce_connections").upsert({
      tenant_id: context.tenantId, provider: "shopify", shop_domain: shopDomain, client_id: clientId,
      client_secret_encrypted: clientSecret ? encryptSecret(clientSecret) : existing!.clientSecretEncrypted,
      access_token_encrypted: clientSecret || existing?.shopDomain !== shopDomain ? null : existing?.accessTokenEncrypted,
      token_expires_at: clientSecret || existing?.shopDomain !== shopDomain ? null : existing?.tokenExpiresAt,
      status: "test_required", last_error: null, updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "test_required" });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}

export async function PATCH(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const body = await req.json().catch(() => ({})) as { actionMode?: unknown; maxCancelAmount?: unknown; status?: unknown };
    const existing = await loadCommerceConnection(context.tenantId, true, "shopify");
    if (!existing) return NextResponse.json({ error: "Shopify connection not found." }, { status: 404 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.actionMode === "disabled") update.action_mode = "disabled";
    if (body.actionMode === "approval_required") {
      const scopeIssue = shopifyScopeIssue(existing.scopes);
      if (existing.status !== "active" || scopeIssue) {
        return NextResponse.json({ error: scopeIssue || "Test and activate Shopify before enabling actions." }, { status: 409 });
      }
      update.action_mode = "approval_required";
    }
    if (body.status === "paused") {
      if (existing.status !== "active") return NextResponse.json({ error: "Only an active connection can be paused." }, { status: 409 });
      update.status = "paused";
    }
    if (body.status === "active") {
      const scopeIssue = shopifyScopeIssue(existing.scopes);
      if (existing.status !== "paused" || scopeIssue) {
        return NextResponse.json({ error: scopeIssue || "Only a tested, paused connection can be resumed." }, { status: 409 });
      }
      update.status = "active";
    }
    if (body.maxCancelAmount !== undefined) {
      const amount = Number(body.maxCancelAmount);
      if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Invalid cancellation limit." }, { status: 400 });
      update.max_cancel_amount = amount;
    }
    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "connection_update_requested",
      targetType: "connection", targetId: existing.id,
      metadata: { actionMode: update.action_mode ?? null, status: update.status ?? null, maxCancelAmount: update.max_cancel_amount ?? null },
    });
    const { error } = await getSupabaseAdmin().from("commerce_connections").update(update).eq("tenant_id", context.tenantId).eq("provider", "shopify");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}

export async function DELETE(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const connection = await loadCommerceConnection(context.tenantId, true, "shopify");
    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "connection_disconnect_requested",
      targetType: "connection", targetId: connection?.id ?? null,
      metadata: { provider: "shopify", shopDomain: connection?.shopDomain ?? null },
    });
    await disconnectCommerceConnection(context.tenantId, "shopify");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    if (connection && appUrl?.startsWith("https://")) {
      await new ShopifyAdapter().unregisterWebhooks(connection, `${appUrl}/api/integrations/shopify/webhook`).catch((error) => {
        console.error("[shopify/disconnect] webhook cleanup failed", error instanceof Error ? error.message : error);
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    const message = error instanceof Error ? error.message : auth.message;
    return NextResponse.json({ error: message }, { status: /executing action/i.test(message) ? 409 : auth.status });
  }
}
