import { NextResponse } from "next/server";

import { AuthorizationError, authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { executeCancellation } from "@/lib/commerce/actions";
import { recordCommerceAudit } from "@/lib/commerce/audit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "action_approval_requested",
      targetType: "action", targetId: id,
    });
    const { data: approved, error: approvalError } = await supabase.from("commerce_action_proposals").update({
      status: "approved", approved_by: context.userId, approved_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
    }).eq("id", id).eq("tenant_id", context.tenantId).eq("status", "proposed").select("id").maybeSingle();
    if (approvalError) throw new Error(`Could not approve the commerce action: ${approvalError.message}`);
    if (!approved) {
      const { data: existing } = await supabase.from("commerce_action_proposals").select("status").eq("id", id).eq("tenant_id", context.tenantId).maybeSingle();
      return NextResponse.json({ error: existing ? `Action is already ${existing.status}.` : "Action not found." }, { status: existing ? 409 : 404 });
    }
    const result = await executeCancellation({ tenantId: context.tenantId, actionId: id });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    const status = auth.status === 401 ? 401 : error instanceof AuthorizationError ? 403 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status });
  }
}
