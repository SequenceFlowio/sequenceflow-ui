import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function recordCommerceAudit(input: {
  tenantId: string;
  actorUserId?: string | null;
  eventType: string;
  targetType: "connection" | "order_link" | "action";
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await getSupabaseAdmin().from("commerce_audit_events").insert({
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`Could not write commerce audit event: ${error.message}`);
}
