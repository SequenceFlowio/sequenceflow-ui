import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { pausedProviderMessage } from "@/lib/commerce/providers";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    requireRole(await getTenantId(req), ["admin"]);
    return NextResponse.json({ error: pausedProviderMessage("shopify") }, { status: 409 });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}
