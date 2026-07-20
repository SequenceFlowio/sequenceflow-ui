import { commerceAdapterFor } from "@/lib/commerce/adapter";
import { reloadCommerceConnection } from "@/lib/commerce/connections";
import { upsertCommerceOrder } from "@/lib/commerce/repository";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { commerceEventRetryDelayMs } from "@/lib/commerce/eventsCore";

export type CommerceEventWorkItem = {
  id: string;
  tenant_id: string;
  connection_id: string;
  provider_event_id: string;
  topic: string;
  event_data: { externalOrderId?: unknown } | null;
  attempts: number;
};

export async function persistAndClaimCommerceEvent(input: {
  tenantId: string;
  connectionId: string;
  providerEventId: string;
  topic: string;
  eventData: Record<string, unknown>;
  occurredAt: string;
}) {
  const supabase = getSupabaseAdmin();
  const { error: persistError } = await supabase.from("commerce_events").upsert({
    tenant_id: input.tenantId,
    connection_id: input.connectionId,
    provider_event_id: input.providerEventId,
    topic: input.topic,
    event_data: input.eventData,
    occurred_at: input.occurredAt,
    status: "pending",
  }, { onConflict: "connection_id,provider_event_id", ignoreDuplicates: true });
  if (persistError) throw new Error(`Could not persist commerce event: ${persistError.message}`);

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase.from("commerce_events").update({
    status: "processing",
    processing_started_at: now,
    error: null,
  }).eq("connection_id", input.connectionId)
    .eq("provider_event_id", input.providerEventId)
    .eq("status", "pending")
    .lt("attempts", 10)
    .select("id,tenant_id,connection_id,provider_event_id,topic,event_data,attempts")
    .maybeSingle();
  if (claimError) throw new Error(`Could not claim commerce event: ${claimError.message}`);
  if (claimed) return { workItem: claimed as CommerceEventWorkItem, state: "claimed" as const };

  const { data: existing, error: loadError } = await supabase.from("commerce_events")
    .select("status,attempts")
    .eq("connection_id", input.connectionId)
    .eq("provider_event_id", input.providerEventId)
    .single();
  if (loadError || !existing) throw new Error(`Could not load commerce event: ${loadError?.message ?? "missing event"}`);
  return { workItem: null, state: existing.status as "processing" | "processed" | "failed" };
}

export async function processCommerceEvent(workItem: CommerceEventWorkItem) {
  const connection = await reloadCommerceConnection(workItem.connection_id);
  const externalOrderId = typeof workItem.event_data?.externalOrderId === "string"
    ? workItem.event_data.externalOrderId
    : null;
  let orderId: string | null = null;
  if (externalOrderId) {
    const order = await commerceAdapterFor(connection).getOrder(connection, externalOrderId);
    if (order) orderId = await upsertCommerceOrder(connection, order);
  }
  const { error } = await getSupabaseAdmin().from("commerce_events").update({
    order_id: orderId,
    status: "processed",
    attempts: Number(workItem.attempts ?? 0) + 1,
    error: null,
    processed_at: new Date().toISOString(),
    processing_started_at: null,
  }).eq("id", workItem.id).eq("status", "processing");
  if (error) throw new Error(`Could not complete commerce event: ${error.message}`);
  return { orderId };
}

export async function failCommerceEvent(workItem: CommerceEventWorkItem, error: unknown) {
  const attempt = Number(workItem.attempts ?? 0) + 1;
  const message = error instanceof Error ? error.message : "Commerce event processing failed.";
  const { error: updateError } = await getSupabaseAdmin().from("commerce_events").update({
    status: "failed",
    attempts: attempt,
    error: message.slice(0, 1000),
    processing_started_at: null,
    next_attempt_at: new Date(Date.now() + commerceEventRetryDelayMs(attempt)).toISOString(),
  }).eq("id", workItem.id).eq("status", "processing");
  if (updateError) throw new Error(`Could not persist commerce event failure: ${updateError.message}`);
}
