import { NextResponse } from "next/server";

import { mapCommerceConnection } from "@/lib/commerce/connections";
import { failCommerceEvent, persistAndClaimCommerceEvent, processCommerceEvent } from "@/lib/commerce/events";
import { bolEventId, normalizeBolEvent, parseBolSignature, verifyBolSignature } from "@/lib/commerce/bolWebhook";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid bol.com event body." }, { status: 400 });
  }
  const event = normalizeBolEvent(payload);
  const signatureHeader = req.headers.get("signature");
  const parsedSignature = parseBolSignature(signatureHeader);
  if (!parsedSignature) return NextResponse.json({ error: "Missing or invalid bol.com signature." }, { status: 401 });
  if (!event) {
    return NextResponse.json({ error: "Incomplete bol.com event." }, { status: 400 });
  }

  const { data: rows, error } = await getSupabaseAdmin().from("commerce_connections")
    .select("*")
    .eq("provider", "bol")
    .eq("status", "active")
    .eq("external_account_id", event.retailerId)
    .limit(2);
  if (error) return NextResponse.json({ error: "Could not inspect bol.com connection." }, { status: 500 });

  let connection = null;
  let missingKeyMaterial = false;
  for (const row of rows ?? []) {
    const candidate = mapCommerceConnection(row);
    const { data: subscriptions } = await getSupabaseAdmin().from("commerce_subscriptions")
      .select("signature_keys")
      .eq("tenant_id", candidate.tenantId)
      .eq("connection_id", candidate.id)
      .in("status", ["active", "pending"]);
    const keys = (subscriptions ?? []).flatMap((subscription) =>
      Array.isArray(subscription.signature_keys) ? subscription.signature_keys : []) as Array<{ id?: string | number; publicKey?: string }>;
    if (!keys.length) missingKeyMaterial = true;
    const key = keys.find((item) => String(item.id) === parsedSignature.keyId)?.publicKey;
    if (key && verifyBolSignature(rawBody, signatureHeader, key)) {
      connection = candidate;
      break;
    }
  }
  if (!connection) {
    return NextResponse.json(
      { error: missingKeyMaterial ? "bol.com signature keys are not ready." : "Invalid bol.com signature." },
      { status: missingKeyMaterial ? 503 : 401 },
    );
  }

  const providerEventId = bolEventId(event);
  const resource = event.resource;
  if (!["ORDER", "SHIPMENT"].includes(resource)) {
    return NextResponse.json({ accepted: true, ignored: true, reason: "unsupported_resource" });
  }
  const claim = await persistAndClaimCommerceEvent({
    tenantId: connection.tenantId,
    connectionId: connection.id,
    providerEventId,
    topic: resource,
    eventData: {
      resource,
      resourceId: event.resourceId,
      externalOrderId: resource === "ORDER" ? event.resourceId : null,
      eventType: event.eventType,
    },
    occurredAt: event.timestamp,
  });
  await getSupabaseAdmin().from("commerce_subscriptions").update({
    last_event_at: event.timestamp,
    last_verified_at: new Date().toISOString(),
    status: "active",
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("tenant_id", connection.tenantId).eq("connection_id", connection.id);
  await getSupabaseAdmin().from("commerce_connections").update({
    events_status: "active",
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id).eq("tenant_id", connection.tenantId);
  if (claim.workItem) {
    processCommerceEvent(claim.workItem).catch(async (processingError) => {
      console.error("[bol/webhook]", processingError);
      await failCommerceEvent(claim.workItem!, processingError).catch((failureError) =>
        console.error("[bol/webhook/failure-state]", failureError));
    });
  }
  return NextResponse.json({ accepted: true }, { status: 202 });
}
