import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// ─── GET /api/integrations/status ──────────────────────────────────────────
// Returns the current integration status for all providers for this tenant.

export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: any) {
    const status = err.message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: err.message }, { status });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("tenant_integrations")
    .select("provider, account_email, status, token_expires_at, expires_at")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[integrations/status] DB error:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }

  // Shape into a provider-keyed map for easy consumption
  const integrations: Record<string, { connected: boolean; account_email: string | null; status: string }> = {};
  for (const row of data ?? []) {
    integrations[row.provider] = {
      connected:     row.status === "connected",
      account_email: row.account_email ?? null,
      status:        row.status,
    };
  }

  return NextResponse.json({ integrations });
}
