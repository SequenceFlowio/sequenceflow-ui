import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { syncBolContext } from "@/lib/commerce/bol";
import { loadCommerceConnection } from "@/lib/commerce/connections";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const connection = await loadCommerceConnection(context.tenantId, false, "bol");
    if (!connection) return NextResponse.json({ error: "Test eerst de bol.com verbinding." }, { status: 409 });
    return NextResponse.json({ ok: true, ...(await syncBolContext(connection, 60)) });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status: auth.status === 401 ? 401 : 400 });
  }
}
