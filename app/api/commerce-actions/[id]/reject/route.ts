import { NextResponse } from "next/server";

import { AuthorizationError, authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { recordCommerceAudit } from "@/lib/commerce/audit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "action_rejection_requested",
      targetType: "action", targetId: id,
    });
    const { data, error } = await supabase.rpc("reject_commerce_action", {
      p_tenant_id: context.tenantId,
      p_action_id: id,
    });
    if (error) throw new Error(`Could not reject the commerce action: ${error.message}`);
    if (!data) return NextResponse.json({ error: "Action is no longer awaiting approval." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    const status = auth.status === 401 ? 401 : error instanceof AuthorizationError ? 403 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status });
  }
}
