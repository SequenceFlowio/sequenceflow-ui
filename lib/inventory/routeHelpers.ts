import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { INVENTORY_PLANS, getTenantPlanAccess } from "@/lib/billing";
import { inventoryAdviceEnabled } from "@/lib/inventory/sync";
import { getTenantId } from "@/lib/tenant";

/**
 * Shared checks for /api/inventory/*: the feature flag (404 while it is off),
 * the plan (403 with `upgrade` below Scale; the page then shows a preview) and
 * who may do what (everyone in the workspace reads, admins change).
 */
export async function inventoryContext(req: Request, adminOnly = false) {
  if (!inventoryAdviceEnabled()) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  try {
    const context = await getTenantId(req);
    const { plan } = await getTenantPlanAccess(context.tenantId);
    if (!INVENTORY_PLANS.includes(plan)) {
      return { response: NextResponse.json({ error: "Voorraad en inkoopadvies zit in het Scale-pakket.", upgrade: true }, { status: 403 }) } as const;
    }
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
