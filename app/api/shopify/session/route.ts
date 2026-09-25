import { NextResponse } from "next/server";
import { authenticateShopify } from "@/lib/shopify/authenticate";
import { getShopifyOfflineAccess } from "@/lib/shopify/installations";
import { authorizationErrorResponse } from "@/lib/auth/authorization";

export const runtime = "nodejs";

/**
 * Opening the app from Shopify. The owner's visit (re)activates the offline
 * token; `linked` tells the UI whether a workspace still has to be chosen.
 */
export async function POST(req: Request) {
  try {
    const identity = await authenticateShopify(req);
    const { tenantId } = await getShopifyOfflineAccess(identity.shop, identity.role === "admin" ? identity.idToken : undefined);
    return NextResponse.json(
      { shop: identity.shop, role: identity.role, linked: Boolean(tenantId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const result = authorizationErrorResponse(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
