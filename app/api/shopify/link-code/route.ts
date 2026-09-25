import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireRole } from "@/lib/auth/authorization";
import { createShopifyLinkCode, hashShopifyLinkCode, SHOPIFY_LINK_CODE_TTL_MS } from "@/lib/shopify/linkCode";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

const enabled = () => process.env.SHOPIFY_PUBLIC_APP_ENABLED === "true";

/** Status for the "Shopify-app koppelen" card in the regular app. */
export async function GET(req: Request) {
  if (!enabled()) return NextResponse.json({ enabled: false });
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const db = getSupabaseAdmin();
    const [{ data: install, error }, { data: tenant, error: tenantError }] = await Promise.all([
      db.from("shopify_installations").select("shop_domain,status").eq("tenant_id", context.tenantId).maybeSingle(),
      db.from("tenants").select("stripe_subscription_id").eq("id", context.tenantId).maybeSingle(),
    ]);
    if (error || tenantError) throw new Error("Could not load Shopify status");
    return NextResponse.json({
      enabled: true,
      linkedShop: install?.shop_domain ?? null,
      linkedStatus: install?.status ?? null,
      hasStripeSubscription: Boolean(tenant?.stripe_subscription_id),
    });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}

/** A one-time code (15 minutes) that proves this workspace to the Shopify app. */
export async function POST(req: Request) {
  if (!enabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const db = getSupabaseAdmin();
    const { data: install, error: installError } = await db.from("shopify_installations").select("shop_domain").eq("tenant_id", context.tenantId).maybeSingle();
    if (installError) throw new Error("Could not load Shopify status");
    if (install) return NextResponse.json({ error: `Deze werkruimte is al gekoppeld aan ${install.shop_domain}.` }, { status: 409 });

    // Older unused codes of this workspace stop working as soon as a new one exists.
    const { error: expireError } = await db.from("shopify_link_codes").update({ expires_at: new Date().toISOString() })
      .eq("tenant_id", context.tenantId).is("used_at", null);
    if (expireError) throw new Error("Could not create link code");

    const code = createShopifyLinkCode();
    const expiresAt = new Date(Date.now() + SHOPIFY_LINK_CODE_TTL_MS).toISOString();
    const { error } = await db.from("shopify_link_codes").insert({
      code_hash: hashShopifyLinkCode(code),
      tenant_id: context.tenantId,
      created_by: context.userId,
      expires_at: expiresAt,
    });
    if (error) throw new Error("Could not create link code");
    return NextResponse.json({ code, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}
