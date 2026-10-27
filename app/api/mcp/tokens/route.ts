import { NextResponse } from "next/server";

import { AuthorizationError, requireRole } from "@/lib/auth/authorization";
import { normalizeMcpTokenName } from "@/lib/mcp/core";
import { listMcpGrants, revokeMcpGrant } from "@/lib/mcp/oauth";
import { McpTokenLimitError, createMcpToken, listMcpTokens, revokeMcpToken } from "@/lib/mcp/tokens";
import { getTenantId } from "@/lib/tenant";

/**
 * Admins manage access to the MCP server (Koppelingen → Claude en ChatGPT):
 * personal keys, and apps connected by signing in (OAuth grants).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Could not update access keys.";
  if (message === "Not authenticated") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Tenant not found for user") return NextResponse.json({ error: message }, { status: 403 });
  console.error("[mcp/tokens]", error);
  return NextResponse.json({ error: "Could not update access keys." }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const [keys, apps] = await Promise.all([listMcpTokens(context.tenantId), listMcpGrants(context.tenantId)]);
    return NextResponse.json({ keys, apps });
  } catch (error) {
    return tokenError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const body = await req.json().catch(() => ({})) as { name?: unknown };
    const name = normalizeMcpTokenName(body.name);
    if (!name) return NextResponse.json({ error: "Give the key a name of at most 80 characters." }, { status: 400 });
    const { token, key } = await createMcpToken({ tenantId: context.tenantId, userId: context.userId, name });
    // The only moment the key itself leaves the server.
    return NextResponse.json({ token, key }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof McpTokenLimitError) {
      return NextResponse.json({ error: "You can have at most 10 active keys. Revoke one first." }, { status: 409 });
    }
    return tokenError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const search = new URL(req.url).searchParams;
    const grantId = search.get("app");
    const id = grantId ?? search.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Unknown key." }, { status: 400 });
    const revoked = grantId ? await revokeMcpGrant(context.tenantId, id) : await revokeMcpToken(context.tenantId, id);
    if (!revoked) return NextResponse.json({ error: "Unknown key." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tokenError(error);
  }
}
