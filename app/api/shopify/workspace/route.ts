import { NextResponse } from "next/server";
import { authenticateShopify } from "@/lib/shopify/authenticate";
import { attachShopifyTenant, getShopifyOfflineAccess, ShopifyLinkError } from "@/lib/shopify/installations";
import { normalizeShopifyLinkCode } from "@/lib/shopify/linkCode";
import { linkAttemptState } from "@/lib/shopify/webhookPolicy";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizationErrorResponse } from "@/lib/auth/authorization";

export const runtime = "nodejs";

/**
 * The shop owner chooses the workspace once: a new one, or an existing
 * SequenceFlow workspace proven with a one-time code from that workspace.
 */
export async function POST(req: Request) {
  try {
    const identity = await authenticateShopify(req);
    if (identity.role !== "admin") {
      return NextResponse.json({ error: "Alleen de winkeleigenaar kan de werkruimte kiezen." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({})) as { mode?: string; code?: string };
    if (body.mode !== "new" && body.mode !== "link") {
      return NextResponse.json({ error: "Kies een nieuwe of een bestaande werkruimte." }, { status: 400 });
    }
    let code: string | undefined;
    if (body.mode === "link") {
      code = normalizeShopifyLinkCode(String(body.code ?? "")) ?? undefined;
      if (!code) return NextResponse.json({ error: "Vul de koppelcode in zoals die in Support One staat, bijvoorbeeld K7PM-3QXR." }, { status: 400 });
    }
    // Make sure the offline token exists before a workspace is attached.
    await getShopifyOfflineAccess(identity.shop, identity.idToken);
    const db = getSupabaseAdmin();
    let attempts = linkAttemptState(0, null);
    if (code) {
      const { data: install } = await db.from("shopify_installations").select("link_failures, link_failures_since").eq("shop_domain", identity.shop).maybeSingle();
      attempts = linkAttemptState(Number(install?.link_failures ?? 0), install?.link_failures_since ?? null);
      if (attempts.blocked) {
        return NextResponse.json({ error: "Te veel onjuiste codes. Probeer het over een uur opnieuw of maak een nieuwe code." }, { status: 429 });
      }
    }
    try {
      await attachShopifyTenant(identity.shop, code);
    } catch (error) {
      if (code && error instanceof ShopifyLinkError) {
        await db.from("shopify_installations")
          .update({ link_failures: attempts.failures + 1, link_failures_since: attempts.windowStart })
          .eq("shop_domain", identity.shop);
      }
      throw error;
    }
    return NextResponse.json({ linked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ShopifyLinkError) return NextResponse.json({ error: error.message }, { status: 400 });
    const result = authorizationErrorResponse(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
