import { NextResponse } from "next/server";

import { AuthorizationError, authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { buildPostNlTrackingUrl, isPostNlShipment, type BolShipment } from "@/lib/commerce/bolCore";
import { bolRequest } from "@/lib/commerce/bolHttp";
import { mapCommerceConnection } from "@/lib/commerce/connections";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ shipmentId: string }> },
) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const { shipmentId } = await params;
    const supabase = getSupabaseAdmin();
    const { data: fulfillment, error: fulfillmentError } = await supabase
      .from("commerce_fulfillments")
      .select("order_id,tracking_company,tracking_number")
      .eq("tenant_id", context.tenantId)
      .eq("external_id", shipmentId)
      .maybeSingle();
    if (fulfillmentError) throw new Error(fulfillmentError.message);
    if (!fulfillment?.tracking_number || !isPostNlShipment(fulfillment.tracking_company, fulfillment.tracking_number)) {
      return NextResponse.json({ error: "Deze zending heeft geen geldige PostNL track & trace-link." }, { status: 404 });
    }

    const { data: order, error: orderError } = await supabase
      .from("commerce_orders")
      .select("connection_id,provider")
      .eq("tenant_id", context.tenantId)
      .eq("id", fulfillment.order_id)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order || order.provider !== "bol") {
      return NextResponse.json({ error: "bol.com-zending niet gevonden." }, { status: 404 });
    }

    const { data: connection, error: connectionError } = await supabase
      .from("commerce_connections")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("id", order.connection_id)
      .eq("provider", "bol")
      .eq("status", "active")
      .maybeSingle();
    if (connectionError) throw new Error(connectionError.message);
    if (!connection) return NextResponse.json({ error: "De bol.com-koppeling is niet actief." }, { status: 409 });

    const remote = await bolRequest<BolShipment>(
      mapCommerceConnection(connection),
      `/retailer/shipments/${encodeURIComponent(shipmentId)}`,
    );
    const trackingNumber = remote.transport?.trackAndTrace ?? fulfillment.tracking_number;
    if (
      trackingNumber.replace(/\s+/g, "").toUpperCase()
      !== String(fulfillment.tracking_number).replace(/\s+/g, "").toUpperCase()
    ) {
      return NextResponse.json({ error: "De actuele track & trace-code komt niet overeen." }, { status: 409 });
    }

    const language = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "nl";
    return NextResponse.redirect(buildPostNlTrackingUrl({
      trackingNumber,
      postalCode: remote.shipmentDetails?.zipCode,
      countryCode: remote.shipmentDetails?.countryCode,
      language,
    }), 307);
  } catch (error) {
    if (
      error instanceof AuthorizationError
      || (error instanceof Error && ["Not authenticated", "Tenant not found for user"].includes(error.message))
    ) {
      const auth = authorizationErrorResponse(error);
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.error("[bol/tracking]", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Track & trace kon niet worden geopend.",
    }, { status: 502 });
  }
}
