import { NextResponse } from "next/server";

import { authorizationErrorResponse } from "@/lib/auth/authorization";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Only the email signature. The Shopify app may change this, but not the rest
 * of the agent config (autosend, discounts), which stays with /api/agent-config.
 */
export async function POST(req: Request) {
  let tenantId: string;
  try {
    const context = await getTenantId(req);
    if (context.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    tenantId = context.tenantId;
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const body = await req.json().catch(() => ({})) as { signature?: unknown };
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  if (!signature) return NextResponse.json({ error: "Signature is required", field: "signature" }, { status: 400 });
  if (signature.length > 1000) return NextResponse.json({ error: "Signature is too long (max 1000 characters)", field: "signature" }, { status: 400 });
  const { error } = await getSupabaseAdmin().from("tenant_agent_config")
    .upsert({ tenant_id: tenantId, signature, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (error) {
    console.error("[agent-config/signature]", error.message);
    return NextResponse.json({ error: "Could not save the signature." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, signature });
}
