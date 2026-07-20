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
    const { data: action, error: actionError } = await supabase
      .from("commerce_action_proposals")
      .select("id,status,confirmation_status")
      .eq("id", id)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();
    if (actionError) throw new Error(actionError.message);
    if (!action) return NextResponse.json({ error: "Action not found." }, { status: 404 });

    if (action.status === "succeeded") {
      if (action.confirmation_status === "prepared") {
        return NextResponse.json({ ok: true, status: "succeeded", confirmationStatus: "prepared" });
      }
      const { error: retryError } = await supabase
        .from("commerce_action_proposals")
        .update({
          confirmation_status: "pending",
          confirmation_attempts: 0,
          confirmation_error: null,
          confirmation_processing_started_at: null,
          confirmation_next_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", context.tenantId)
        .eq("status", "succeeded");
      if (retryError) throw new Error(retryError.message);
      await recordCommerceAudit({
        tenantId: context.tenantId, actorUserId: context.userId, eventType: "confirmation_retry_requested",
        targetType: "action", targetId: id,
      });
      return NextResponse.json({ ok: true, status: "succeeded", confirmationStatus: "pending" });
    }

    await recordCommerceAudit({
      tenantId: context.tenantId, actorUserId: context.userId, eventType: "action_retry_requested",
      targetType: "action", targetId: id,
    });
    const result = await executeCancellation({ tenantId: context.tenantId, actionId: id });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    const status = auth.status === 401 ? 401 : error instanceof AuthorizationError ? 403 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : auth.message }, { status });
  }
}
