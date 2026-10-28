import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { inventoryAdviceEnabled } from "@/lib/inventory/sync";
import { getTenantId } from "@/lib/tenant";

/**
 * Shared checks for /api/inventory/*: the feature flag (404 while it is off)
 * and who may do what (everyone in the workspace reads, admins change).
 */
export async function inventoryContext(req: Request, adminOnly = false) {
  if (!inventoryAdviceEnabled()) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  try {
    const context = await getTenantId(req);
    return { context: adminOnly ? requireRole(context, ["admin"]) : context } as const;
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return { response: NextResponse.json({ error: auth.message }, { status: auth.status }) } as const;
  }
}

export function inventoryError(error: unknown, scope: string) {
  console.error(`[inventory/${scope}]`, error);
  return NextResponse.json({ error: "Dit lukte niet. Probeer het over een paar minuten opnieuw." }, { status: 500 });
}
