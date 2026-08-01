import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { requestAppOrigin } from "@/lib/brand";
import { recordCommerceAudit } from "@/lib/commerce/audit";
import { BolAdapter } from "@/lib/commerce/bol";
import { disconnectCommerceConnection, loadCommerceConnection } from "@/lib/commerce/connections";
import { encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

function safeConnection(connection: Awaited<ReturnType<typeof loadCommerceConnection>>) {
  return connection ? {
    provider: connection.provider,
    status: connection.status,
    clientId: connection.clientId,
    hasSecret: Boolean(connection.clientSecretEncrypted),
    displayName: connection.displayName,
    externalAccountId: connection.externalAccountId,
    setupStage: connection.setupStage,
    mailboxVerifiedAt: connection.mailboxVerifiedAt,
    eventsStatus: connection.eventsStatus,
    lastSyncedAt: connection.lastSyncedAt,
    lastReturnsSyncedAt: connection.lastReturnsSyncedAt,
    lastError: connection.lastError,
  } : null;
}

export async function GET(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    return NextResponse.json({ connection: safeConnection(await loadCommerceConnection(context.tenantId, true, "bol")) });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}

export async function POST(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const body = await req.json().catch(() => ({})) as { clientId?: unknown; clientSecret?: unknown };
    const clientId = String(body.clientId ?? "").trim();
    const clientSecret = String(body.clientSecret ?? "").trim();
    if (!/^[a-zA-Z0-9_-]{8,200}$/.test(clientId)) {
      return NextResponse.json({ error: "Vul een geldige bol.com Client ID in." }, { status: 400 });
    }
    const existing = await loadCommerceConnection(context.tenantId, true, "bol");
    if (!clientSecret && !existing?.clientSecretEncrypted) {
      return NextResponse.json({ error: "Vul de bol.com client secret in." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error } = await getSupabaseAdmin().from("commerce_connections").upsert({
      tenant_id: context.tenantId,
      provider: "bol",
      shop_domain: `bol:${clientId.toLowerCase()}`,
      client_id: clientId,
      client_secret_encrypted: clientSecret ? encryptSecret(clientSecret) : existing!.clientSecretEncrypted,
      access_token_encrypted: existing?.accessTokenEncrypted ?? encryptSecret(randomBytes(32).toString("base64url")),
      token_expires_at: null,
      scopes: [],
      status: "test_required",
      action_mode: "disabled",
      auth_mode: "client_credentials",
      setup_stage: "credentials",
      events_status: "not_configured",
      last_error: null,
      updated_at: now,
    }, { onConflict: "tenant_id,provider" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordCommerceAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      eventType: "connection_save_requested",
      targetType: "connection",
      targetId: existing?.id ?? null,
      metadata: { provider: "bol", replacingSecret: Boolean(clientSecret) },
    });
    return NextResponse.json({ ok: true, status: "test_required" });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status: auth.status === 401 ? 401 : 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const connection = await loadCommerceConnection(context.tenantId, true, "bol");
    const appUrl = requestAppOrigin(req.url);
    if (connection?.status === "active" && appUrl.startsWith("https://")) {
      await new BolAdapter().unregisterWebhooks(connection, `${appUrl}/api/integrations/bol/webhook`);
    }
    await recordCommerceAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      eventType: "connection_disconnect_requested",
      targetType: "connection",
      targetId: connection?.id ?? null,
      metadata: { provider: "bol" },
    });
    await disconnectCommerceConnection(context.tenantId, "bol");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status: auth.status });
  }
}
