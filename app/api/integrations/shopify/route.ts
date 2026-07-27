import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { loadCommerceConnection } from "@/lib/commerce/connections";
import { pausedProviderMessage } from "@/lib/commerce/providers";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const connection = await loadCommerceConnection(context.tenantId, true, "shopify");
    return NextResponse.json({ connection: connection ? {
      provider: connection.provider,
      shopDomain: connection.shopDomain,
      status: "paused",
      clientId: connection.clientId,
      scopes: connection.scopes,
      actionMode: "disabled",
      maxCancelAmount: connection.maxCancelAmount,
      shopCurrency: connection.shopCurrency,
      hasSecret: Boolean(connection.clientSecretEncrypted),
      displayName: connection.displayName,
      lastSyncedAt: connection.lastSyncedAt,
      lastError: pausedProviderMessage("shopify"),
    } : null });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}

async function blocked(req: Request) {
  try {
    requireRole(await getTenantId(req), ["admin"]);
    return NextResponse.json({ error: pausedProviderMessage("shopify") }, { status: 409 });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}

export const POST = blocked;
export const PATCH = blocked;
export const DELETE = blocked;
