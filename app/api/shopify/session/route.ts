import { NextResponse } from "next/server";
import { authenticateShopify } from "@/lib/shopify/authenticate";
import { getShopifyOfflineAccess } from "@/lib/shopify/installations";
import { authorizationErrorResponse } from "@/lib/auth/authorization";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Someone opening the app from Shopify proves it is installed. Any uninstall
 * still waiting in the queue is therefore older than a reinstall: drop it, and
 * have the owner's visit fetch fresh tokens (the old ones were revoked).
 */
async function settleStaleUninstalls(shop: string, isOwner: boolean) {
  const db = getSupabaseAdmin();
  const { data: stale } = await db.from("shopify_webhook_jobs").select("id")
    .eq("shop_domain", shop).eq("topic", "app/uninstalled").in("status", ["pending", "failed", "processing"]);
  if (!stale?.length) return;
  await db.from("shopify_webhook_jobs").update({ status: "completed", completed_at: new Date().toISOString(), payload_encrypted: "", last_error: "superseded by reinstall" })
    .in("id", stale.map((row) => row.id));
  if (isOwner) {
    const now = new Date().toISOString();
    await db.from("shopify_installations").update({ access_expires_at: now, refresh_expires_at: now }).eq("shop_domain", shop);
  }
}

/**
 * Opening the app from Shopify. The owner's visit (re)activates the offline
 * token; `linked` tells the UI whether a workspace still has to be chosen.
 */
export async function POST(req: Request) {
  try {
    const identity = await authenticateShopify(req);
    await settleStaleUninstalls(identity.shop, identity.role === "admin");
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
