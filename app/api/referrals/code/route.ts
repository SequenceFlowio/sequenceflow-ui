import { NextRequest, NextResponse } from "next/server";

import { claimPartnerCode, partnerCodeStatus } from "@/lib/referrals/server";
import { allowRequest } from "@/lib/security/rateLimit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/** Partnercode van de eigen werkruimte: welke er hangt, en er alsnog één invullen tijdens de proef. */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    return NextResponse.json(await partnerCodeStatus(tenantId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[referrals/code] laden mislukt", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Laden mislukt" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getTenantId(req);
    if (!(await allowRequest("partner-code-claim", context.tenantId, { limit: 10, windowSeconds: 60 * 60 }))) {
      return NextResponse.json({ error: "Te veel pogingen. Probeer het later opnieuw." }, { status: 429 });
    }
    const body = await req.json().catch(() => ({})) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.trim().toLowerCase().replace(/^@/, "").slice(0, 40) : "";
    if (!code) return NextResponse.json({ error: "Vul een code in." }, { status: 400 });
    // Het e-mailadres is nodig om te voorkomen dat een affiliate zijn eigen code gebruikt.
    const email = context.userId ? (await getSupabaseAdmin().auth.admin.getUserById(context.userId)).data.user?.email ?? null : null;
    const result = await claimPartnerCode(context.tenantId, { id: context.userId ?? "", email }, code);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result.status);
  } catch (error) {
    console.error("[referrals/code] invullen mislukt", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Code invullen lukte niet. Probeer het later opnieuw." }, { status: 500 });
  }
}
