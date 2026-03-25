import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "Not authenticated" ? 401 : 403 });
  }

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { error, count } = await supabase
    .from("tickets")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .in("id", ids);

  if (error) {
    console.error("[bulk-delete]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: count ?? ids.length });
}
